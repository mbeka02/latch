import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { AccessError } from '@/lib/access-error';
import type { OpenpathTransport } from '@/services/openpath';

export interface NativeOpenpathClient {
  request(handle: string, method: string, path: string, token: string | null, json: string | null): Promise<{ status: number; body: string }>;
  cancel(handle: string): void;
}

let sequence = 0;
export function createAndroidTransport(native: NativeOpenpathClient | null = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeOpenpathClient>('LatchOpenpathTransport') : null): OpenpathTransport {
  return async (request, signal) => {
    if (!native || signal.aborted) throw new AccessError('unavailable');
    const handle = `openpath-${++sequence}`;
    const cancel = () => { try { native.cancel(handle); } catch { /* still fail closed at the caller's deadline */ } };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const response = await native.request(handle, request.method, request.path, request.token ?? null,
        request.body ? JSON.stringify(request.body) : null);
      if (signal.aborted) throw new AccessError('unavailable');
      return response;
    } finally { signal.removeEventListener('abort', cancel); }
  };
}
