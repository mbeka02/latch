export type AccessErrorCode =
  | 'invalid-credentials' | 'mfa-required' | 'mfa-invalid' | 'unsupported-auth'
  | 'unavailable' | 'expired' | 'storage' | 'stale-operation' | 'access-denied' | 'entry-not-found'
  | 'organisation-required' | 'organisation-unavailable' | 'ambiguous-entry' | 'credential-unavailable' | 'access-changed';

const messages: Record<AccessErrorCode, string> = {
  'invalid-credentials': 'Sign-in failed. Check your email and password.',
  'mfa-required': 'Enter your password again and the code from your authenticator.',
  'mfa-invalid': 'That authenticator code was not accepted. Enter your password and a new code.',
  'unsupported-auth': 'This account requires a sign-in method Latch does not support. Use a supported native Alta account.',
  unavailable: 'The service is unavailable. Try again when your connection is restored.',
  expired: 'Your session has expired. Sign in again.',
  storage: 'Secure session storage is unavailable. Try signing in again.',
  'stale-operation': 'This operation belongs to a previous session.',
  'access-denied': 'Door access is unavailable for this account.',
  'entry-not-found': 'No COE Door was found in this organisation. Check your access with IFSS.',
  'organisation-required': 'Choose an organisation before checking door access.',
  'organisation-unavailable': 'Organisation names are missing or ambiguous. Ask IFSS to clarify your memberships.',
  'ambiguous-entry': 'COE Door matches cannot be distinguished by site and zone. Ask IFSS to clarify the entries.',
  'credential-unavailable': 'Exactly one currently valid Cloud Key is required. Ask IFSS to check your credentials.',
  'access-changed': 'Door access has changed. Refresh access and confirm the door again.',
};

export class AccessError extends Error {
  constructor(public readonly code: AccessErrorCode) {
    super(messages[code]);
    this.name = 'AccessError';
  }
}

export function safeAccessError(error: unknown): AccessError {
  return error instanceof AccessError ? error : new AccessError('unavailable');
}
