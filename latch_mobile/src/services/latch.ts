import type { Openpath, ProviderSession, SignInInput, UserContext, UserSession } from '@/lib/openpath';
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

export type SessionOptions = { now?: () => number; storage?: SessionStorage };

export type DoorChoice = {
  key: string;
  name: string;
  organisation: string;
  site: string;
  zone: string;
};

export interface DoorAccessService {
  discoverDoors(): Promise<DoorChoice[]>;
  requestUnlock(choiceKey: string): Promise<{ status: 'accepted'; simulated: boolean }>;
}

export function createLatch(provider: Openpath, { now = Date.now, storage }: SessionOptions = {}): { auth: AuthService; doors: DoorAccessService } {
  let session: ProviderSession | null = null;
  let expiresAt = 0;
  let startedAt = 0;
  let selection: { key: string; context: UserContext; entryId: number; credentialId: number } | null = null;
  let sequence = 0;
  let generation = 0;
  let storageQueue: Promise<unknown> = Promise.resolve();
  let storageNeedsClear = false;
  let snapshot: AuthSnapshot = { status: 'restoring', session: null, expiresAt: null, error: null };
  const listeners = new Set<() => void>();
  function publish(status: AuthSnapshot['status'], error: AccessErrorCode | null = null) {
    snapshot = { status, error, session: session ? { ...session.user } : null, expiresAt: session ? expiresAt : null };
    listeners.forEach((listener) => listener());
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
      const operation = ++generation;
      session = null;
      selection = null;
      publish('signed-out', 'expired');
      if (storage) void stored(() => storage.clear()).catch(() => {
        if (operation === generation) publish('signed-out', 'storage');
      });
      throw new AccessError('expired');
    }
    return session;
  }
  async function upstream<T>(operation: number, work: () => Promise<T>): Promise<T> {
    try {
      const result = await work();
      assertCurrent(operation);
      return result;
    } catch (error) {
      assertCurrent(operation);
      const failure = safeAccessError(error);
      if (failure.code === 'expired') {
        const invalidated = ++generation;
        session = null;
        selection = null;
        publish('signed-out', 'expired');
        try { if (storage) await stored(() => storage.clear()); }
        catch {
          if (invalidated === generation) publish('signed-out', 'storage');
        }
      }
      throw failure;
    }
  }
  return {
    auth: {
      async signIn(input) {
        const operation = ++generation;
        selection = null;
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
            token: candidate.token, identityId: candidate.user.identityId, startedAt, expiresAt });
          if (storage) await stored(() => storage.write(record));
          assertCurrent(operation);
          if (now() >= expiresAt || now() < startedAt) throw new AccessError('expired');
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
        const operation = ++generation;
        session = null;
        selection = null;
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
          let saved: { token: string; identityId: string; startedAt: number; expiresAt: number; environment: string; version: number };
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
          const candidate = await provider.checkSession(saved.token);
          assertCurrent(operation);
          if (candidate.expiresAt !== null && !Number.isFinite(candidate.expiresAt)) throw new AccessError('unavailable');
          if (candidate.token !== saved.token || candidate.user.identityId !== saved.identityId) throw new AccessError('expired');
          startedAt = saved.startedAt;
          expiresAt = Math.min(saved.expiresAt, startedAt + SESSION_CAP_MS, candidate.expiresAt ?? Infinity);
          if (now() >= expiresAt || now() < startedAt) throw new AccessError('expired');
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
        const operation = ++generation;
        session = null;
        selection = null;
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
      async requestUnlock(choiceKey) {
        currentSession();
        if (!session || !selection || selection.key !== choiceKey || selection.context.token !== session.token) {
          throw new Error('Refresh door access before requesting an unlock.');
        }
        const chosen = selection;
        await upstream(generation, () => provider.unlockEntry({
          context: chosen.context,
          entryId: chosen.entryId,
          credentialId: chosen.credentialId,
        }));
        return { status: 'accepted', simulated: provider.environment === 'demo' };
      },
      async discoverDoors() {
        currentSession();
        const operation = generation;
        selection = null;
        if (!session || session.memberships.length !== 1) {
          throw new Error('Sign in with a single demo organisation to discover COE Door.');
        }
        const context = { token: session.token, membership: session.memberships[0] };
        const [entries, credentials] = await upstream(operation, () => Promise.all([
          provider.listUserEntries(context),
          provider.listCredentials(context),
        ]));
        assertCurrent(operation);
        currentSession();
        const matches = entries.filter((entry) => entry.name.trim().toLowerCase() === 'coe door');
        const keys = credentials.filter((credential) => credential.kind === 'cloud-key');
        if (matches.length !== 1 || keys.length !== 1) {
          throw new Error('COE Door access is unavailable for this account.');
        }
        const entry = matches[0];
        const key = `choice-${++sequence}`;
        selection = { key, context, entryId: entry.id, credentialId: keys[0].id };
        return [{
          key,
          name: entry.name,
          organisation: context.membership.organisation,
          site: entry.site,
          zone: entry.zone,
        }];
      },
    },
  };
}
