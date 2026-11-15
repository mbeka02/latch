export type SignInInput = { email: string; password: string; totpCode?: string };

export type UserSession = { identityId: string; name: string; email: string };

export type Membership = { orgId: number; userId: number; organisation: string };
// Lookup hints only: never cached authorization, scopes, or door access.
export type SessionHints = { identityId: string; associations: { orgId: number; userId: number }[] };

export type Entry = { id: number; name: string; site: string; zone: string };
// Normalized validity bounds are epoch milliseconds; null means unbounded.
export type Credential = { id: number; kind: 'cloud-key' | 'mobile' | 'other'; validFrom: number | null; validUntil: number | null };
export type CredentialPage = { items: Credential[]; nextOffset: number | null };
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
  checkSession(token: string, hints?: SessionHints): Promise<ProviderSession>;
  listUserEntries(context: UserContext): Promise<Entry[]>;
  listCredentials(context: UserContext, offset: number): Promise<CredentialPage>;
  unlockEntry(command: UnlockCommand): Promise<void>;
}
