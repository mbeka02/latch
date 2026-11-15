import { createContext, use, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import type { Openpath, SignInInput, UserSession } from '@/lib/openpath';
import { createLatch, type AuthSnapshot, type SessionOptions, type UnlockSnapshot } from '@/services/latch';
import { createMockOpenpath } from '@/services/mocks/openpath';
import { createOpenpath } from '@/services/openpath';
import { createAndroidTransport } from '@/services/openpath-transport';
import { secureAttemptStorage, secureSessionStorage } from '@/storage/session';

type LatchContextValue = {
  environment: Openpath['environment'];
  app: ReturnType<typeof createLatch>;
  session: UserSession | null;
  authState: AuthSnapshot;
  unlockState: UnlockSnapshot;
  coolingDown: boolean;
  retrySession(): void;
  signIn(input: SignInInput): Promise<void>;
  signOut(): void;
};

const LatchContext = createContext<LatchContextValue | null>(null);

function configuredProvider(): Openpath {
  const mode = process.env.EXPO_PUBLIC_LATCH_MODE ?? 'demo';
  if (mode === 'demo') return createMockOpenpath();
  if (mode !== 'live') throw new Error('EXPO_PUBLIC_LATCH_MODE must be demo or live.');
  return createOpenpath(createAndroidTransport(), { namespaceNickname: process.env.EXPO_PUBLIC_ALTA_NAMESPACE });
}

export function LatchProvider({ children, provider, storage, attemptStorage, now = Date.now }: PropsWithChildren<{ provider?: Openpath } & SessionOptions>) {
  const [adapter] = useState(() => provider ?? configuredProvider());
  // One provider and one app instance per mount; environments never switch mid-session.
  const [app] = useState(() => {
    return createLatch(adapter, { now, storage: storage ?? secureSessionStorage(adapter.environment),
      attemptStorage: attemptStorage ?? secureAttemptStorage(adapter.environment) });
  });
  const authState = useSyncExternalStore(app.auth.subscribe, app.auth.getSnapshot, app.auth.getSnapshot);
  const unlockState = useSyncExternalStore(app.doors.subscribe, app.doors.getSnapshot, app.doors.getSnapshot);
  const [completedCooldown, setCompletedCooldown] = useState(0);
  const coolingDown = unlockState.cooldownUntil > Math.max(now(), completedCooldown);
  useEffect(() => {
    const remaining = unlockState.cooldownUntil - now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setCompletedCooldown(unlockState.cooldownUntil), remaining);
    return () => clearTimeout(timer);
  }, [unlockState.cooldownUntil, now]);
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
      if (state !== 'active') app.doors.interruptUnlock();
      if (state === 'active' && app.auth.getSession()) void app.auth.restore().catch(() => {});
    });
    return () => { subscription.remove(); app.doors.interruptUnlock(); };
  }, [app]);

  async function signIn(input: SignInInput) {
    await app.auth.signIn(input);
  }

  function signOut() {
    void app.auth.signOut().catch(() => {});
  }

  return <LatchContext value={{ environment: adapter.environment, app, session: authState.session, authState, unlockState, coolingDown, retrySession, signIn, signOut }}>{children}</LatchContext>;
}

export function useLatch() {
  const value = use(LatchContext);
  if (!value) throw new Error('LatchProvider is required.');
  return value;
}
