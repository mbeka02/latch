import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';
import { toast } from 'sonner-native';
import * as SecureStore from 'expo-secure-store';
import type { ProviderSession } from '@/lib/openpath';

import RootLayout from '@/app/_layout';
import HomeScreen from '@/app/index';
import DoorScreen from '@/app/door';
import { createMockOpenpath } from '@/services/mocks/openpath';
import { createLatch } from '@/services/latch';

afterEach(async () => {
  await act(async () => { toast.dismiss(); });
  jest.restoreAllMocks();
});

test('demo launch identifies simulated access and offers sign-in without an unlock action', async () => {
  await renderRouter(
    { _layout: RootLayout, index: HomeScreen, door: DoorScreen },
    { initialUrl: '/' },
  );

  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
});

test('the employee can show and hide their password without changing its value', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');

  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));

  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false);
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));

  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('latch-demo-only');
});

test('failed sign-in shows a toast and keeps recovery guidance on the form', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'incorrect-password');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Unable to sign in')).toBeOnTheScreen();
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed. Use the demo account shown above.');
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('');
  expect(screen).toHavePathname('/');

  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(screen.queryByText('Unable to sign in')).not.toBeOnTheScreen();
});

test('cancelling the themed confirmation leaves the simulated door unrequested', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));

  expect(await screen.findByRole('header', { name: 'Unlock COE Door?' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

  expect(provider.getUnlockRequests()).toEqual([]);
  await waitFor(() => expect(screen.queryByRole('header', { name: 'Unlock COE Door?' })).not.toBeOnTheScreen());
  expect(screen.queryByText('Simulated unlock accepted. No physical door was operated.')).not.toBeOnTheScreen();
});

test('Back and backdrop dismiss the confirmation without requesting an unlock', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));

  await fireEvent(screen.getByTestId('app-modal'), 'requestClose');
  await waitFor(() => expect(screen.queryByTestId('app-modal')).not.toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(await screen.findByTestId('modal-backdrop'));

  await waitFor(() => expect(screen.queryByTestId('app-modal')).not.toBeOnTheScreen());
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('confirming unlock reports simulated acceptance and sends the discovered request', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));

  expect(provider.getUnlockRequests()).toEqual([]);
  expect(within(await screen.findByTestId('app-modal')).getByText('IFSS demo · Demo building · COE')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));

  expect(await screen.findByText('Simulated unlock accepted')).toBeOnTheScreen();
  expect(await screen.findByText('Simulated unlock accepted. No physical door was operated.')).toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([
    { orgId: 101, userId: 202, entryId: 303, credentialId: 404 },
  ]);
  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Simulated unlock accepted/ }));

  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
  expect(screen.getByText('Simulated unlock accepted. No physical door was operated.')).toBeOnTheScreen();
});

test('the employee can sign in to the discovered demo door and sign out', async () => {
  await renderRouter(
    { _layout: RootLayout, index: HomeScreen, door: DoorScreen },
    { initialUrl: '/' },
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(screen.getByText('demo@latch.example')).toBeOnTheScreen();
  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  expect(screen).toHavePathname('/door');

  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
});

test('an unlock failure shows a warning toast and preserves the uncertain result after dismissal', async () => {
  const provider = {
    ...createMockOpenpath(),
    async unlockEntry() { throw new Error('Provider details should not be displayed.'); },
  };
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock' }));

  await fireEvent.press(await screen.findByRole('button', { name: /Unlock result unconfirmed/ }));

  expect(screen.queryByText('Unlock result unconfirmed')).not.toBeOnTheScreen();
  expect(screen.getByText("We couldn't confirm the result. Check before trying again.")).toBeOnTheScreen();
  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
  expect(screen.queryByText('Provider details should not be displayed.')).not.toBeOnTheScreen();
});

test('unavailable door access shows an error toast while unlock remains unavailable', async () => {
  const provider = createMockOpenpath({ entries: [] });
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  await fireEvent.press(await screen.findByRole('button', { name: /COE access unavailable/ }));

  expect(screen.getByRole('alert')).toHaveTextContent('COE Door access is unavailable.');
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('the employee can complete demo MFA after correcting an invalid authenticator code', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'mfa@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByLabelText('Authenticator code')).toBeOnTheScreen();
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '000000');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('That authenticator code was not accepted. Enter your password and a new code.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Authenticator code')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(screen.getByText('mfa@latch.example')).toBeOnTheScreen();
});

test('returning to an expired session replaces the door screen with sign-in guidance', async () => {
  let time = 1_800_000;
  let onChange: ((status: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') onChange = listener;
    return { remove() {} };
  });
  const Layout = () => <RootLayout now={() => time} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();

  time = 2_700_000;
  await act(async () => { onChange?.('active'); });

  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Sign in again.');
  expect(screen.queryByRole('button', { name: /Unlock COE Door/ })).not.toBeOnTheScreen();
});

test('cancelling MFA clears the entered secrets and its obsolete notification', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'mfa@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.changeText(await screen.findByLabelText('Authenticator code'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel sign-in' }));

  expect(screen.getByLabelText('Password')).toHaveDisplayValue('');
  expect(screen.queryByLabelText('Authenticator code')).not.toBeOnTheScreen();
  expect(screen.queryByText('Authenticator code required')).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Unlock COE Door/ })).not.toBeOnTheScreen();
});

test('a restart waits for a current provider check before restoring secure native session data', async () => {
  const nativeValues = new Map<string, string>();
  jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (key) => nativeValues.get(key) ?? null);
  jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value) => { nativeValues.set(key, value); });
  jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async (key) => { nativeValues.delete(key); });
  const base = createMockOpenpath();
  let finishCheck!: (session: ProviderSession) => void;
  const check = new Promise<ProviderSession>((resolve) => { finishCheck = resolve; });
  const provider = { ...base, async checkSession() { return check; } };
  const Layout = () => <RootLayout provider={provider} />;
  const first = await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'mfa@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.changeText(await screen.findByLabelText('Authenticator code'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  const stored = nativeValues.get('latch.demo.session.v1');
  expect(stored).toBeDefined();
  expect(stored).not.toContain('latch-demo-only');
  expect(stored).not.toContain('123456');
  await first.unmount();

  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  expect(screen.getByText('Checking secure session…')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Unlock COE Door/ })).not.toBeOnTheScreen();
  await act(async () => { finishCheck(await base.checkSession('simulated-session:mfa@latch.example')); });

  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(screen.getByText('mfa@latch.example')).toBeOnTheScreen();
  expect(base.getUnlockRequests()).toEqual([]);
});

test('a startup service outage offers explicit recovery without granting cached door access', async () => {
  const base = createMockOpenpath();
  let saved: string | null = null;
  const storage = {
    async read() { return saved; },
    async write(value: string) { saved = value; },
    async clear() { saved = null; },
  };
  await createLatch(base, { storage }).auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  let offline = true;
  const provider = { ...base, async checkSession(token: string) {
    if (offline) throw new Error('Private provider response');
    return base.checkSession(token);
  } };
  const Layout = () => <RootLayout provider={provider} storage={storage} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });

  expect(await screen.findByRole('alert')).toHaveTextContent('The service is unavailable. Try again when your connection is restored.');
  expect(screen.queryByRole('button', { name: 'Unlock COE Door' })).not.toBeOnTheScreen();
  offline = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry session check' }));

  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(base.getUnlockRequests()).toEqual([]);
});

test('a late unlock response after session expiry does not notify the signed-out screen', async () => {
  let time = 1_800_000;
  let onChange: ((status: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') onChange = listener;
    return { remove() {} };
  });
  let finish!: () => void;
  const response = new Promise<void>((resolve) => { finish = resolve; });
  const base = createMockOpenpath();
  const provider = { ...base, async unlockEntry(command: Parameters<typeof base.unlockEntry>[0]) {
    await response;
    await base.unlockEntry(command);
  } };
  const Layout = () => <RootLayout provider={provider} now={() => time} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock' }));
  time = 2_700_000;
  await act(async () => { onChange?.('active'); });
  await waitFor(() => expect(screen).toHavePathname('/'));

  await act(async () => { finish(); });

  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
  expect(screen.queryByText('Unlock result unconfirmed')).not.toBeOnTheScreen();
  expect(base.getUnlockRequests()).toHaveLength(1);
});
