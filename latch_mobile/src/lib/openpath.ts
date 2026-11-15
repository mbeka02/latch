export type SignInInput = { email: string; password: string; totpCode?: string };

export type UserSession = { identityId: string; name: string; email: string };

export type Membership = { orgId: number; userId: number; organisation: string };

export type Entry = { id: number; name: string; site: string; zone: string };
export type Credential = { id: number; kind: 'cloud-key' | 'mobile' };
export type UserContext = { token: string; membership: Membership };
export type UnlockCommand = { context: UserContext; entryId: number; credentialId: number };

export type ProviderSession = {
  token: string;
  expiresAt: number | null;
  user: UserSession;
  memberships: Membership[];
};

export interface Openpath {
  readonly environment: 'demo' | 'live';
  login(input: SignInInput): Promise<ProviderSession>;
  // A current authorized identity read, not a locally decoded token or a refresh.
  checkSession(token: string): Promise<ProviderSession>;
  listUserEntries(context: UserContext): Promise<Entry[]>;
  listCredentials(context: UserContext): Promise<Credential[]>;
  unlockEntry(command: UnlockCommand): Promise<void>;
}
