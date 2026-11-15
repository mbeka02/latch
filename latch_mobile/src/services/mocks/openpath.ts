import type { Credential, Entry, Openpath, ProviderSession, SignInInput, UserContext } from '@/lib/openpath';
import { AccessError } from '@/lib/access-error';

type UnlockRecord = { orgId: number; userId: number; entryId: number; credentialId: number };
export interface MockOpenpath extends Openpath {
  getUnlockRequests(): readonly UnlockRecord[];
}

export function createMockOpenpath(fixtures: { entries?: Entry[]; credentials?: Credential[] } = {}): MockOpenpath {
  const entries = fixtures.entries ?? [
    { id: 303, name: 'COE Door', site: 'Demo building', zone: 'COE' },
  ];
  const credentials = fixtures.credentials ?? [{ id: 404, kind: 'cloud-key' as const, validFrom: null, validUntil: null }];
  const unlocks: UnlockRecord[] = [];
  const supportedEmails = ['demo@latch.example', 'mfa@latch.example', 'multi@latch.example', 'no-key@latch.example',
    'missing@latch.example', 'ambiguous@latch.example', 'denied@latch.example', 'uncertain@latch.example',
    'unlock-denied@latch.example', 'timeout@latch.example'];
  function sessionFor(email: string): ProviderSession {
    return {
      token: `simulated-session:${email}`,
      expiresAt: null,
      user: { identityId: email === 'demo@latch.example' ? 'demo-employee' : email, name: 'Demo employee', email },
      memberships: [
        { orgId: 101, userId: email === 'mfa@latch.example' ? 203 : 202, organisation: 'IFSS demo' },
        ...(email === 'multi@latch.example' ? [{ orgId: 606, userId: 707, organisation: 'Engineering demo' }] : []),
      ],
    };
  }
  function checkContext(context: UserContext) {
    const email = context.token.replace('simulated-session:', '');
    if (!supportedEmails.includes(email) || context.token !== `simulated-session:${email}` ||
        !sessionFor(email).memberships.some(({ orgId, userId }) =>
          orgId === context.membership.orgId && userId === context.membership.userId)) {
      throw new Error('Demo access denied.');
    }
  }
  function entriesFor(context: UserContext): Entry[] {
    if (!fixtures.entries && context.token === 'simulated-session:missing@latch.example') {
      return [{ id: 990, name: 'Reception', site: 'Demo building', zone: 'Lobby' }];
    }
    if (!fixtures.entries && context.token === 'simulated-session:ambiguous@latch.example') {
      return [303, 304].map((id) => ({ id, name: 'COE Door', site: 'Demo building', zone: 'COE' }));
    }
    return context.membership.orgId === 606 && !fixtures.entries ? [
      { id: 808, name: 'COE Door', site: 'North building', zone: 'COE' },
      { id: 809, name: 'COE Door', site: 'South building', zone: 'COE' },
    ] : entries;
  }
  function credentialsFor(context: UserContext): Credential[] {
    if (!fixtures.credentials && context.token === 'simulated-session:no-key@latch.example') {
      return [{ id: 510, kind: 'mobile', validFrom: null, validUntil: null }];
    }
    return context.membership.userId === 203 && !fixtures.credentials
      ? [{ id: 505, kind: 'cloud-key', validFrom: null, validUntil: null }]
      : credentials;
  }

  return {
    environment: 'demo',
    async login(input: SignInInput) {
      if (input.email === 'sso@latch.example') throw new AccessError('unsupported-auth');
      if (input.email === 'offline@latch.example') throw new AccessError('unavailable');
      if (input.email === 'mfa@latch.example' && input.password === 'latch-demo-only') {
        if (!input.totpCode) throw new AccessError('mfa-required');
        if (input.totpCode !== '123456') throw new AccessError('mfa-invalid');
      }
      if (!supportedEmails.includes(input.email) || input.password !== 'latch-demo-only') {
        throw new AccessError('invalid-credentials');
      }
      return sessionFor(input.email);
    },
    async checkSession(token) {
      const email = token.replace('simulated-session:', '');
      if (!supportedEmails.includes(email) || token !== `simulated-session:${email}`) {
        throw new AccessError('expired');
      }
      return sessionFor(email);
    },
    async listUserEntries(context) {
      checkContext(context);
      if (context.token === 'simulated-session:denied@latch.example') throw new AccessError('access-denied');
      return entriesFor(context).map((entry) => ({ ...entry }));
    },
    async listCredentials(context, offset = 0) {
      checkContext(context);
      const all = credentialsFor(context);
      const end = offset + 2;
      return { items: all.slice(offset, end).map((credential) => ({ ...credential })),
        nextOffset: end < all.length ? end : null };
    },
    async unlockEntry({ context, entryId, credentialId }) {
      checkContext(context);
      if (context.token === 'simulated-session:unlock-denied@latch.example') throw new AccessError('access-denied');
      if (context.token === 'simulated-session:denied@latch.example') throw new AccessError('access-denied');
      if (!entriesFor(context).some((entry) => entry.id === entryId) ||
          !credentialsFor(context).some((credential) => credential.id === credentialId && credential.kind === 'cloud-key')) {
        throw new Error('Demo unlock denied.');
      }
      unlocks.push({
        orgId: context.membership.orgId,
        userId: context.membership.userId,
        entryId,
        credentialId,
      });
      if (context.token === 'simulated-session:uncertain@latch.example') throw new Error('Simulated lost response.');
      if (context.token === 'simulated-session:timeout@latch.example') await new Promise<void>(() => {});
    },
    getUnlockRequests() {
      return unlocks.map((unlock) => ({ ...unlock }));
    },
  };
}
