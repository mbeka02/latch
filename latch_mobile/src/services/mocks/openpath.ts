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
  const credentials = fixtures.credentials ?? [{ id: 404, kind: 'cloud-key' as const }];
  const unlocks: UnlockRecord[] = [];
  function sessionFor(email: string): ProviderSession {
    return {
      token: `simulated-session:${email}`,
      expiresAt: null,
      user: { identityId: email === 'demo@latch.example' ? 'demo-employee' : email, name: 'Demo employee', email },
      memberships: [{ orgId: 101, userId: email === 'mfa@latch.example' ? 203 : 202, organisation: 'IFSS demo' }],
    };
  }
  function checkContext(context: UserContext) {
    const email = context.token.replace('simulated-session:', '');
    if (!['demo@latch.example', 'mfa@latch.example'].includes(email) ||
        context.token !== `simulated-session:${email}` || context.membership.orgId !== 101 ||
        context.membership.userId !== sessionFor(email).memberships[0].userId) {
      throw new Error('Demo access denied.');
    }
  }
  function credentialsFor(context: UserContext): Credential[] {
    return context.membership.userId === 203 && !fixtures.credentials
      ? [{ id: 505, kind: 'cloud-key' }]
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
      if (!['demo@latch.example', 'mfa@latch.example'].includes(input.email) || input.password !== 'latch-demo-only') {
        throw new AccessError('invalid-credentials');
      }
      return sessionFor(input.email);
    },
    async checkSession(token) {
      const email = token.replace('simulated-session:', '');
      if (!['demo@latch.example', 'mfa@latch.example'].includes(email) || token !== `simulated-session:${email}`) {
        throw new AccessError('expired');
      }
      return sessionFor(email);
    },
    async listUserEntries(context) {
      checkContext(context);
      return entries.map((entry) => ({ ...entry }));
    },
    async listCredentials(context) {
      checkContext(context);
      return credentialsFor(context).map((credential) => ({ ...credential }));
    },
    async unlockEntry({ context, entryId, credentialId }) {
      checkContext(context);
      if (!entries.some((entry) => entry.id === entryId) ||
          !credentialsFor(context).some((credential) => credential.id === credentialId && credential.kind === 'cloud-key')) {
        throw new Error('Demo unlock denied.');
      }
      unlocks.push({
        orgId: context.membership.orgId,
        userId: context.membership.userId,
        entryId,
        credentialId,
      });
    },
    getUnlockRequests() {
      return unlocks.map((unlock) => ({ ...unlock }));
    },
  };
}
