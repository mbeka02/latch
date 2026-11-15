import type { Credential, Entry, Openpath, ProviderSession, SignInInput, UserContext, UserSession } from '@/lib/openpath';
import { AccessError, safeAccessError, type AccessErrorCode } from '@/lib/access-error';
import type { SessionStorage } from '@/lib/session-storage';

const SESSION_CAP_MS = 15 * 60 * 1000;

export type AuthSnapshot = {
  status: 'signed-out' | 'signing-in' | 'restoring' | 'authenticated';
  session: UserSession | null;
  expiresAt: number | null;
  error: AccessErrorCode | null;
};

export interface AuthService {
  signIn(input: SignInInput): Promise<UserSession>;
  restore(): Promise<UserSession | null>;
  getSession(): UserSession | null;
  signOut(): Promise<void>;
  getSnapshot(): AuthSnapshot;
  subscribe(listener: () => void): () => void;
}

export type SessionOptions = { now?: () => number; storage?: SessionStorage; attemptStorage?: SessionStorage };

export type DoorChoice = {
  key: string;
  name: string;
  organisation: string;
  site: string;
  zone: string;
};

export type OrganisationChoice = { key: string; name: string };
export type UnlockSnapshot = {
  status: 'idle' | 'pending' | 'accepted' | 'denied' | 'unknown' | 'not-sent';
  door: Omit<DoorChoice, 'key'> | null;
  cooldownUntil: number;
  requiresAcknowledgement: boolean;
  error: AccessErrorCode | null;
};

type AttemptRecord = {
  identityId: string; originStartedAt: number; orgId: number; userId: number; entryId: number;
  door: Omit<DoorChoice, 'key'>; createdAt: number; cooldownUntil: number; unresolved: boolean;
};

export interface DoorAccessService {
  discoverOrganisations(): OrganisationChoice[];
  discoverDoors(organisationKey?: string): Promise<DoorChoice[]>;
  acknowledgeUnknown(): Promise<void>;
  interruptUnlock(): void;
  getSnapshot(): UnlockSnapshot;
  subscribe(listener: () => void): () => void;
  requestUnlock(choiceKey: string): Promise<{ status: 'accepted' | 'denied' | 'unknown'; simulated: boolean }>;
}

export function createLatch(provider: Openpath, { now = Date.now, storage, attemptStorage }: SessionOptions = {}): { auth: AuthService; doors: DoorAccessService } {
  let session: ProviderSession | null = null;
  let expiresAt = 0;
  let startedAt = 0;
  let selections: { key: string; context: UserContext; entry: Entry; credentialId: number }[] = [];
  let sequence = 0;
  let discovery = 0;
  let unresolved = false;
  let busy = false;
  let cancelUnlock: (() => void) | null = null;
  let cooldownUntil = 0;
  let generation = 0;
  let storageQueue: Promise<unknown> = Promise.resolve();
  let storageNeedsClear = false;
  let snapshot: AuthSnapshot = { status: 'restoring', session: null, expiresAt: null, error: null };
  const listeners = new Set<() => void>();
  const unlockListeners = new Set<() => void>();
  let unlockSnapshot: UnlockSnapshot = { status: 'idle', door: null, cooldownUntil: 0, requiresAcknowledgement: false, error: null };
  function publishUnlock(status: UnlockSnapshot['status'], door = unlockSnapshot.door, error: AccessErrorCode | null = null) {
    unlockSnapshot = { status, door, error, cooldownUntil: session ? cooldownUntil : 0,
      requiresAcknowledgement: session ? unresolved : false };
    unlockListeners.forEach((listener) => listener());
  }
  let attemptRecords: AttemptRecord[] = [];
  async function loadAttempts(identityId: string) {
    const result = storageQueue.then(async () => {
      const raw = attemptStorage ? await attemptStorage.read() : null;
      const saved = raw ? JSON.parse(raw) : { version: 1, environment: provider.environment, records: [] };
      if (!saved || saved.version !== 1 || saved.environment !== provider.environment ||
          !Array.isArray(saved.records) || saved.records.length > 100) throw new Error();
      for (const item of saved.records) {
        if (!item || typeof item.identityId !== 'string' || !item.identityId ||
            !['originStartedAt', 'createdAt', 'cooldownUntil'].every((field) => Number.isFinite(item[field]) && item[field] >= 0) ||
            !['orgId', 'userId', 'entryId'].every((field) => Number.isSafeInteger(item[field]) && item[field] > 0) ||
            typeof item.unresolved !== 'boolean' || !item.door ||
            !['name', 'organisation', 'site', 'zone'].every((field) => typeof item.door[field] === 'string')) throw new Error();
      }
      if (new Set(saved.records.map((item: AttemptRecord) => item.identityId)).size !== saved.records.length) throw new Error();
      attemptRecords = saved.records;
    });
    storageQueue = result.catch(() => {});
    try { await result; } catch { throw new AccessError('attempt-storage'); }
    const previous = attemptRecords.find((item) => item.identityId === identityId);
    unresolved = previous?.unresolved ?? false;
    cooldownUntil = previous?.unresolved ? Math.max(previous.cooldownUntil, now() + 3000) : previous?.cooldownUntil ?? 0;
  }
  async function writeAttempts(update: (records: AttemptRecord[]) => AttemptRecord[], guard: () => void = () => {}) {
    const result = storageQueue.then(async () => {
      guard();
      const records = update(attemptRecords);
      if (!attemptStorage) throw new AccessError('attempt-storage');
      if (records.length > 100) throw new AccessError('attempt-storage');
      await attemptStorage.write(JSON.stringify({ version: 1, environment: provider.environment, records }));
      attemptRecords = records;
    });
    storageQueue = result.catch(() => {});
    try { await result; } catch (error) {
      if (error instanceof AccessError) throw error;
      throw new AccessError('attempt-storage');
    }
  }
  function publish(status: AuthSnapshot['status'], error: AccessErrorCode | null = null) {
    snapshot = { status, error, session: session ? { ...session.user } : null, expiresAt: session ? expiresAt : null };
    listeners.forEach((listener) => listener());
    const previous = attemptRecords.find((item) => item.identityId === session?.user.identityId);
    publishUnlock(status === 'authenticated' && unresolved ? 'unknown' : 'idle',
      status === 'authenticated' && unresolved ? previous?.door ?? null : null);
  }
  function assertCurrent(operation: number) {
    if (operation !== generation) throw new AccessError('stale-operation');
  }
  async function stored<T>(action: () => Promise<T>): Promise<T> {
    const result = storageQueue.then(action);
    storageQueue = result.catch(() => {});
    try { return await result; } catch { storageNeedsClear = true; throw new AccessError('storage'); }
  }
  function currentSession() {
    if (session && (now() >= expiresAt || now() < startedAt)) {
      cancelUnlock?.();
      const operation = ++generation;
      session = null;
      selections = [];
      publish('signed-out', 'expired');
      if (storage) void stored(() => storage.clear()).catch(() => {
        if (operation === generation) publish('signed-out', 'storage');
      });
      throw new AccessError('expired');
    }
    return session;
  }
  async function upstream<T>(operation: number, work: () => Promise<T>, guard: () => void = () => {}): Promise<T> {
    try {
      const result = await work();
      assertCurrent(operation);
      guard();
      return result;
    } catch (error) {
      assertCurrent(operation);
      guard();
      const failure = safeAccessError(error);
      if (failure.code === 'expired') {
        cancelUnlock?.();
        const invalidated = ++generation;
        session = null;
        selections = [];
        publish('signed-out', 'expired');
        try { if (storage) await stored(() => storage.clear()); }
        catch {
          if (invalidated === generation) publish('signed-out', 'storage');
        }
      }
      throw failure;
    }
  }
  async function readCredentials(context: UserContext, operation: number, guard: () => void = () => {}) {
    const credentials: Credential[] = [];
    let offset = 0;
    for (let page = 0; page < 100; page++) {
      const result = await upstream(operation, () => provider.listCredentials(context, offset), guard);
      credentials.push(...result.items);
      if (result.nextOffset === null) return credentials;
      if (!Number.isSafeInteger(result.nextOffset) || result.nextOffset <= offset) throw new AccessError('unavailable');
      offset = result.nextOffset;
    }
    throw new AccessError('unavailable');
  }
  function usableKeys(credentials: Credential[]) {
    const time = now();
    return credentials.filter((credential) => credential.kind === 'cloud-key' &&
      (credential.validFrom === null || (Number.isFinite(credential.validFrom) && credential.validFrom <= time)) &&
      (credential.validUntil === null || (Number.isFinite(credential.validUntil) && time < credential.validUntil)));
  }
  function checkOrganisations() {
    if (!session) throw new AccessError('expired');
    const names = session.memberships.map(({ organisation }) => organisation.trim().toLowerCase());
    if (names.some((name) => !name) || new Set(names).size !== names.length) throw new AccessError('organisation-unavailable');
  }
  return {
    auth: {
      async signIn(input) {
        cancelUnlock?.();
        const operation = ++generation;
        selections = [];
        session = null;
        publish('signing-in');
        try {
          if (storage) await stored(() => storage.clear());
          assertCurrent(operation);
          storageNeedsClear = false;
          const candidate = await provider.login(input);
          assertCurrent(operation);
          if (candidate.expiresAt !== null && !Number.isFinite(candidate.expiresAt)) throw new AccessError('unavailable');
          startedAt = now();
          expiresAt = Math.min(startedAt + SESSION_CAP_MS, candidate.expiresAt ?? Infinity);
          if (expiresAt <= now()) throw new AccessError('expired');
          const record = JSON.stringify({ version: 1, environment: provider.environment,
            token: candidate.token, identityId: candidate.user.identityId, startedAt, expiresAt,
            associations: candidate.memberships.map(({ orgId, userId }) => ({ orgId, userId })) });
          if (storage) await stored(() => storage.write(record));
          assertCurrent(operation);
          if (now() >= expiresAt || now() < startedAt) throw new AccessError('expired');
          await loadAttempts(candidate.user.identityId);
          assertCurrent(operation);
          session = candidate;
          publish('authenticated');
        } catch (error) {
          assertCurrent(operation);
          const failure = safeAccessError(error);
          publish('signed-out', failure.code);
          throw failure;
        }
        return { ...session.user };
      },
      async restore() {
        cancelUnlock?.();
        const operation = ++generation;
        session = null;
        selections = [];
        publish('restoring');
        try {
          if (storageNeedsClear && storage) {
            await stored(() => storage.clear());
            assertCurrent(operation);
            storageNeedsClear = false;
            publish('signed-out');
            return null;
          }
          const raw = storage ? await stored(() => storage.read()) : null;
          assertCurrent(operation);
          if (!raw) { publish('signed-out'); return null; }
          let saved: { token: string; identityId: string; startedAt: number; expiresAt: number; environment: string; version: number;
            associations?: { orgId: number; userId: number }[] };
          try {
            saved = JSON.parse(raw);
            if (!saved || saved.version !== 1 || saved.environment !== provider.environment ||
                typeof saved.token !== 'string' || !saved.token || typeof saved.identityId !== 'string' || !saved.identityId ||
                !Number.isFinite(saved.startedAt) || !Number.isFinite(saved.expiresAt)) throw new Error();
          } catch {
            if (storage) await stored(() => storage.clear());
            throw new AccessError('storage');
          }
          if (now() < saved.startedAt || now() >= Math.min(saved.expiresAt, saved.startedAt + SESSION_CAP_MS)) {
            throw new AccessError('expired');
          }
          const candidate = await provider.checkSession(saved.token,
            saved.associations ? { identityId: saved.identityId, associations: saved.associations } : undefined);
          assertCurrent(operation);
          if (candidate.expiresAt !== null && !Number.isFinite(candidate.expiresAt)) throw new AccessError('unavailable');
          if (candidate.token !== saved.token || candidate.user.identityId !== saved.identityId) throw new AccessError('expired');
          startedAt = saved.startedAt;
          expiresAt = Math.min(saved.expiresAt, startedAt + SESSION_CAP_MS, candidate.expiresAt ?? Infinity);
          if (now() >= expiresAt || now() < startedAt) throw new AccessError('expired');
          await loadAttempts(candidate.user.identityId);
          assertCurrent(operation);
          session = candidate;
          publish('authenticated');
          return { ...candidate.user };
        } catch (error) {
          assertCurrent(operation);
          let failure = safeAccessError(error);
          if (failure.code === 'expired' && storage) {
            try { await stored(() => storage.clear()); } catch { failure = new AccessError('storage'); }
          }
          assertCurrent(operation);
          publish('signed-out', failure.code);
          throw failure;
        }
      },
      getSession() {
        try { currentSession(); } catch { return null; }
        return session ? { ...session.user } : null;
      },
      async signOut() {
        cancelUnlock?.();
        const operation = ++generation;
        session = null;
        selections = [];
        publish('signed-out');
        try { if (storage) await stored(() => storage.clear()); }
        catch (error) {
          assertCurrent(operation);
          // Overwrite a token that native deletion could not remove. If both
          // native mutations fail, physical erasure cannot be guaranteed.
          if (storage) {
            try { await stored(() => storage.write('null')); } catch { /* Recovery remains blocked. */ }
          }
          assertCurrent(operation);
          publish('signed-out', 'storage');
          throw error;
        }
      },
      getSnapshot: () => snapshot,
      subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
    doors: {
      interruptUnlock() { cancelUnlock?.(); },
      getSnapshot: () => unlockSnapshot,
      subscribe(listener) { unlockListeners.add(listener); return () => { unlockListeners.delete(listener); }; },
      async acknowledgeUnknown() {
        currentSession();
        if (!session) throw new AccessError('expired');
        if (busy) throw new AccessError('unlock-pending');
        if (!unresolved) return;
        const operation = generation;
        const identityId = session.user.identityId;
        await writeAttempts((records) => records.map((item) => item.identityId === identityId ? { ...item, unresolved: false, cooldownUntil } : item), () => assertCurrent(operation));
        assertCurrent(operation);
        unresolved = false;
        publishUnlock('unknown');
      },
      discoverOrganisations() {
        currentSession();
        discovery++;
        selections = [];
        if (!session) throw new AccessError('expired');
        checkOrganisations();
        return session.memberships.map((membership, index) => ({
          key: `org-${generation}-${index}`, name: membership.organisation,
        }));
      },
      async requestUnlock(choiceKey) {
        currentSession();
        if (unresolved) throw new AccessError('acknowledgement-required');
        if (busy) throw new AccessError('unlock-pending');
        if (now() < cooldownUntil) throw new AccessError('cooldown');
        const chosen = selections.find((choice) => choice.key === choiceKey);
        if (!session || !chosen || chosen.context.token !== session.token) throw new AccessError('access-changed');
        const operation = generation;
        const identityId = session.user.identityId;
        busy = true;
        const displayDoor = { name: chosen.entry.name, organisation: chosen.context.membership.organisation,
          site: chosen.entry.site, zone: chosen.entry.zone };
        publishUnlock('pending', displayDoor);
        let stopped = false;
        let dispatched = false;
        function check() {
          assertCurrent(operation);
          if (stopped) throw new AccessError('stale-operation');
          currentSession();
        }
        let interrupt!: () => void;
        const interruption = new Promise<{ status: 'unknown'; simulated: boolean }>((resolve, reject) => {
          interrupt = () => {
            if (stopped) return;
            stopped = true;
            if (dispatched) {
              unresolved = true;
              cooldownUntil = now() + 3000;
              publishUnlock('unknown', displayDoor);
              resolve({ status: 'unknown', simulated: provider.environment === 'demo' });
            } else {
              publishUnlock('not-sent', displayDoor, 'request-not-sent');
              reject(new AccessError('request-not-sent'));
            }
          };
        });
        cancelUnlock = interrupt;
        const timer = setTimeout(interrupt, 15_000);
        async function run() {
          const [entries, credentials] = await upstream(operation, () => Promise.all([
            provider.listUserEntries(chosen!.context), readCredentials(chosen!.context, operation, check),
          ]), check);
          check();
          const keys = usableKeys(credentials);
          const entry = entries.find((item) => item.id === chosen!.entry.id);
          if (!selections.includes(chosen!) || !entry || entry.name !== chosen!.entry.name ||
              entry.site !== chosen!.entry.site || entry.zone !== chosen!.entry.zone ||
              keys.length !== 1 || keys[0].id !== chosen!.credentialId) {
            if (selections.includes(chosen!)) selections = [];
            throw new AccessError('access-changed');
          }
          const marker: AttemptRecord = {
            identityId, originStartedAt: startedAt,
            orgId: chosen!.context.membership.orgId, userId: chosen!.context.membership.userId, entryId: chosen!.entry.id,
            door: { name: chosen!.entry.name, organisation: chosen!.context.membership.organisation,
              site: chosen!.entry.site, zone: chosen!.entry.zone },
            createdAt: now(), cooldownUntil: now() + 3000, unresolved: true,
          };
          await writeAttempts((records) => [...records.filter((item) => item.identityId !== identityId &&
            (item.unresolved || item.cooldownUntil > now())), marker], check);
          check();
          if (!selections.includes(chosen!)) throw new AccessError('access-changed');
          dispatched = true;
          let status: 'accepted' | 'denied' | 'unknown' = 'accepted';
          try {
            await upstream(operation, async () => {
              try { await provider.unlockEntry({ context: chosen!.context, entryId: chosen!.entry.id, credentialId: chosen!.credentialId }); }
              catch (error) { check(); throw error; }
              check();
            });
          } catch (error) {
            check();
            const code = safeAccessError(error).code;
            if (['expired', 'stale-operation'].includes(code)) throw error;
            status = code === 'access-denied' ? 'denied' : 'unknown';
          }
          check();
          cooldownUntil = now() + 3000;
          unresolved = status === 'unknown';
          try {
            await writeAttempts((records) => records.map((item) => item === marker ? { ...marker, unresolved, cooldownUntil } : item), check);
            check();
          } catch {
            check();
            unresolved = true;
            status = 'unknown';
          }
          return { status, simulated: provider.environment === 'demo' };
        }
        try {
          const result = await Promise.race([run(), interruption]);
          if (operation === generation && !stopped) publishUnlock(result.status, displayDoor);
          return result;
        } catch (error) {
          if (operation === generation && !stopped) publishUnlock('not-sent', displayDoor, safeAccessError(error).code);
          throw error;
        }
        finally {
          stopped = true;
          clearTimeout(timer);
          if (cancelUnlock === interrupt) { cancelUnlock = null; busy = false; }
        }
      },
      async discoverDoors(organisationKey) {
        currentSession();
        const operation = generation;
        const revision = ++discovery;
        selections = [];
        if (!session) throw new AccessError('expired');
        checkOrganisations();
        const membership = organisationKey === undefined && session.memberships.length === 1
          ? session.memberships[0]
          : session.memberships.find((_, index) => organisationKey === `org-${generation}-${index}`);
        if (!membership) throw new AccessError('organisation-required');
        const context = { token: session.token, membership };
        const [entries, credentials] = await upstream(operation, () => Promise.all([
          provider.listUserEntries(context),
          readCredentials(context, operation),
        ]));
        assertCurrent(operation);
        currentSession();
        if (revision !== discovery) throw new AccessError('access-changed');
        const matches = entries.filter((entry) => entry.name.trim().toLowerCase() === 'coe door');
        const keys = usableKeys(credentials);
        if (!matches.length) throw new AccessError('entry-not-found');
        const contexts = matches.map((entry) => JSON.stringify([entry.site.trim().toLowerCase(), entry.zone.trim().toLowerCase()]));
        if (new Set(contexts).size !== matches.length) throw new AccessError('ambiguous-entry');
        if (keys.length !== 1) throw new AccessError('credential-unavailable');
        return matches.map((entry) => {
          const key = `choice-${++sequence}`;
          selections.push({ key, context, entry: { ...entry }, credentialId: keys[0].id });
          return { key, name: entry.name, organisation: context.membership.organisation,
            site: entry.site, zone: entry.zone };
        });
      },
    },
  };
}
