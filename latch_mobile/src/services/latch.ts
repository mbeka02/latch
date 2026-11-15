import type { Openpath, ProviderSession, SignInInput, UserContext, UserSession } from '@/lib/openpath';

export interface AuthService {
  signIn(input: SignInInput): Promise<UserSession>;
  getSession(): UserSession | null;
  signOut(): void;
}

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

export function createLatch(provider: Openpath): { auth: AuthService; doors: DoorAccessService } {
  let session: ProviderSession | null = null;
  let selection: { key: string; context: UserContext; entryId: number; credentialId: number } | null = null;
  let sequence = 0;
  return {
    auth: {
      async signIn(input) {
        selection = null;
        session = await provider.login(input);
        return { ...session.user };
      },
      getSession() {
        return session ? { ...session.user } : null;
      },
      signOut() {
        session = null;
        selection = null;
      },
    },
    doors: {
      async requestUnlock(choiceKey) {
        if (!session || !selection || selection.key !== choiceKey || selection.context.token !== session.token) {
          throw new Error('Refresh door access before requesting an unlock.');
        }
        await provider.unlockEntry({
          context: selection.context,
          entryId: selection.entryId,
          credentialId: selection.credentialId,
        });
        return { status: 'accepted', simulated: provider.environment === 'demo' };
      },
      async discoverDoors() {
        selection = null;
        if (!session || session.memberships.length !== 1) {
          throw new Error('Sign in with a single demo organisation to discover COE Door.');
        }
        const context = { token: session.token, membership: session.memberships[0] };
        const [entries, credentials] = await Promise.all([
          provider.listUserEntries(context),
          provider.listCredentials(context),
        ]);
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
