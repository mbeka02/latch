import type { Credential, Entry, Openpath, SignInInput, UserContext } from '@/lib/openpath';

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
  function checkContext(context: UserContext) {
    if (context.token !== 'simulated-session-not-a-real-alta-token' ||
        context.membership.orgId !== 101 || context.membership.userId !== 202) {
      throw new Error('Demo access denied.');
    }
  }

  return {
    environment: 'demo',
    async login(input: SignInInput) {
      if (input.email !== 'demo@latch.example' || input.password !== 'latch-demo-only') {
        throw new Error('Use the demo account shown on the sign-in screen.');
      }
      return {
        token: 'simulated-session-not-a-real-alta-token',
        user: {
          identityId: 'demo-employee',
          name: 'Demo employee',
          email: 'demo@latch.example',
        },
        memberships: [{ orgId: 101, userId: 202, organisation: 'IFSS demo' }],
      };
    },
    async listUserEntries(context) {
      checkContext(context);
      return entries.map((entry) => ({ ...entry }));
    },
    async listCredentials(context) {
      checkContext(context);
      return credentials.map((credential) => ({ ...credential }));
    },
    async unlockEntry({ context, entryId, credentialId }) {
      checkContext(context);
      if (!entries.some((entry) => entry.id === entryId) ||
          !credentials.some((credential) => credential.id === credentialId && credential.kind === 'cloud-key')) {
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
