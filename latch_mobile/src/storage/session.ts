import * as SecureStore from 'expo-secure-store';

import type { SessionStorage } from '@/lib/session-storage';
import { altaNamespaceNickname } from '@/constants/alta';

// Live records are bound to the fixed EU region and configured namespace.
// Legacy US records stay untouched and can never be hydrated into this context.
export function secureSessionStorage(environment: 'demo' | 'live'): SessionStorage {
  return secureRecordStorage(`latch.${storageScope(environment)}.session.v1`);
}

export function secureAttemptStorage(environment: 'demo' | 'live'): SessionStorage {
  return secureRecordStorage(`latch.${storageScope(environment)}.attempts.v1`);
}

function storageScope(environment: 'demo' | 'live') {
  if (environment === 'demo') return 'demo';
  // Code-point encoding is collision-free and uses SecureStore-safe characters.
  const namespace = Array.from(altaNamespaceNickname(), (character) => character.codePointAt(0)!.toString(16)).join('-') || 'default';
  return `live.eu.${namespace}`;
}

function secureRecordStorage(key: string): SessionStorage {
  return {
    read: () => SecureStore.getItemAsync(key),
    write: (value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    clear: () => SecureStore.deleteItemAsync(key),
  };
}
