import { createContext, use, useState, type PropsWithChildren } from 'react';

import type { Openpath, SignInInput, UserSession } from '@/lib/openpath';
import { createLatch } from '@/services/latch';
import { createMockOpenpath } from '@/services/mocks/openpath';

type LatchContextValue = {
  app: ReturnType<typeof createLatch>;
  session: UserSession | null;
  signIn(input: SignInInput): Promise<void>;
  signOut(): void;
};

const LatchContext = createContext<LatchContextValue | null>(null);

export function LatchProvider({ children, provider }: PropsWithChildren<{ provider?: Openpath }>) {
  // One app instance per mount. There is no live adapter or runtime environment switch yet.
  const [app] = useState(() => createLatch(provider ?? createMockOpenpath()));
  const [session, setSession] = useState<UserSession | null>(null);

  async function signIn(input: SignInInput) {
    setSession(await app.auth.signIn(input));
  }

  function signOut() {
    app.auth.signOut();
    setSession(null);
  }

  return <LatchContext value={{ app, session, signIn, signOut }}>{children}</LatchContext>;
}

export function useLatch() {
  const value = use(LatchContext);
  if (!value) throw new Error('LatchProvider is required.');
  return value;
}
