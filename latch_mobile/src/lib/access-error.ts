export type AccessErrorCode =
  | 'invalid-credentials' | 'mfa-required' | 'mfa-invalid' | 'unsupported-auth'
  | 'unavailable' | 'invalid-response' | 'expired' | 'storage' | 'stale-operation' | 'access-denied' | 'entries-empty' | 'entry-not-found'
  | 'organisation-required' | 'organisation-unavailable' | 'credential-unavailable' | 'access-changed'
  | 'acknowledgement-required' | 'unlock-pending' | 'cooldown' | 'attempt-storage' | 'request-not-sent';

const messages: Record<AccessErrorCode, string> = {
  'invalid-credentials': 'Sign-in failed. Check your credentials and authenticator code, if required.',
  'mfa-required': 'Enter the six-digit code from your authenticator app.',
  'mfa-invalid': 'That authenticator code was not accepted. Enter a new code.',
  'unsupported-auth': 'This account requires a sign-in method Latch does not support. Use a supported native Alta account.',
  unavailable: 'The service is unavailable. Try again when your connection is restored.',
  'invalid-response': 'Alta returned a response Latch could not verify. Try again or contact IFSS.',
  expired: 'Your session has expired. Sign in again.',
  storage: 'Secure session storage is unavailable. Try signing in again.',
  'stale-operation': 'This operation belongs to a previous session.',
  'access-denied': 'Alta denied this access request. Check your permissions with IFSS.',
  'entries-empty': 'Alta returned no entries for your account in this organisation. Ask IFSS to confirm your door access.',
  'entry-not-found': 'Alta returned entries, but none has the word COE in its name. Ask IFSS to confirm the door name and organisation.',
  'organisation-required': 'Choose an organisation before checking door access.',
  'organisation-unavailable': 'Organisation names are missing or ambiguous. Ask IFSS to clarify your memberships.',
  'credential-unavailable': 'Exactly one currently valid Cloud Key is required. Ask IFSS to check your credentials.',
  'access-changed': 'Door access has changed. Refresh access and confirm the door again.',
  'acknowledgement-required': 'Check the previous unlock result and acknowledge it before trying again.',
  'unlock-pending': 'An unlock request is already in progress.',
  cooldown: 'Wait a moment before making another unlock request.',
  'attempt-storage': 'Unlock recovery storage is unavailable. No new request can be sent safely.',
  'request-not-sent': 'The unlock request was not sent. Refresh access before trying again.',
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
