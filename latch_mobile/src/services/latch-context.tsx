import { createContext, use, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import type { Openpath, SignInInput, UserSession } from '@/lib/openpath';
import { createLatch, type AuthSnapshot, type SessionOptions } from '@/services/latch';
import { createMockOpenpath } from '@/services/mocks/openpath';
import { secureSessionStorage } from '@/storage/session';

type LatchContextValue = {
  app: ReturnType<typeof createLatch>;
  session: UserSession | null;
  authState: AuthSnapshot;
  retrySession(): void;
  signIn(input: SignInInput): Promise<void>;
  signOut(): void;
};

const LatchContext = createContext<LatchContextValue | null>(null);

export function LatchProvider({ children, provider, storage, now = Date.now }: PropsWithChildren<{ provider?: Openpath } & SessionOptions>) {
  // One app instance per mount. There is no live adapter or runtime environment switch yet.
  const [app] = useState(() => {
    const adapter = provider ?? createMockOpenpath();
    return createLatch(adapter, { now, storage: storage ?? secureSessionStorage(adapter.environment) });
  });
  const authState = useSyncExternalStore(app.auth.subscribe, app.auth.getSnapshot, app.auth.getSnapshot);
  function retrySession() { void app.auth.restore().catch(() => {}); }
  useEffect(() => {
    void app.auth.restore().catch(() => {});
  }, [app]);
  useEffect(() => {
    if (!authState.session || authState.expiresAt === null) return;
    const timer = setTimeout(() => { app.auth.getSession(); }, Math.max(0, authState.expiresAt - now()));
    return () => clearTimeout(timer);
  }, [app, authState.session, authState.expiresAt, now]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && app.auth.getSession()) void app.auth.restore().catch(() => {});
    });
    return () => subscription.remove();
  }, [app]);

  async function signIn(input: SignInInput) {
    await app.auth.signIn(input);
  }

  function signOut() {
    void app.auth.signOut().catch(() => {});
  }

  return <LatchContext value={{ app, session: authState.session, authState, retrySession, signIn, signOut }}>{children}</LatchContext>;
}

export function useLatch() {
  const value = use(LatchContext);
  if (!value) throw new Error('LatchProvider is required.');
  return value;
}
