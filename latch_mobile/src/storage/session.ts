import * as SecureStore from 'expo-secure-store';

import type { SessionStorage } from '@/lib/session-storage';

// Separate storage namespaces prevent a demo token being hydrated in a live build.
export function secureSessionStorage(environment: 'demo' | 'live'): SessionStorage {
  return secureRecordStorage(`latch.${environment}.session.v1`);
}

export function secureAttemptStorage(environment: 'demo' | 'live'): SessionStorage {
  return secureRecordStorage(`latch.${environment}.attempts.v1`);
}

function secureRecordStorage(key: string): SessionStorage {
  return {
    read: () => SecureStore.getItemAsync(key),
    write: (value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    clear: () => SecureStore.deleteItemAsync(key),
  };
}
