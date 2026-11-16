import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';
import { toast } from 'sonner-native';
import * as SecureStore from 'expo-secure-store';
import { NativeModulesProxy } from 'expo-modules-core';
import type { Entry, ProviderSession } from '@/lib/openpath';
import { AccessError } from '@/lib/access-error';

import RootLayout, { ErrorBoundary } from '@/app/_layout';
import HomeScreen from '@/app/index';
import DoorScreen from '@/app/door';
import { createMockOpenpath } from '@/services/mocks/openpath';
import { createLatch } from '@/services/latch';
import { createOpenpath, type OpenpathRequest } from '@/services/openpath';
import * as Sentry from '@sentry/react-native';
import * as Reanimated from 'react-native-reanimated';
import NotFoundScreen from '@/app/+not-found';

test('the configured IFSS live app signs in with the exact org namespace through its native client', async () => {
  const previousMode = process.env.EXPO_PUBLIC_LATCH_MODE;
  const previousNamespace = process.env.EXPO_PUBLIC_ALTA_NAMESPACE;
  process.env.EXPO_PUBLIC_LATCH_MODE = 'live';
  delete process.env.EXPO_PUBLIC_ALTA_NAMESPACE;
  const requests: { path: string; body: string | null }[] = [];
  const native = { cancel() {}, async request(_handle: string, _method: string, path: string, _token: string | null, body: string | null) {
    requests.push({ path, body });
    if (path === '/auth/login') {
      if (JSON.parse(body!).namespaceNickname !== 'org:ifss-group') return { status: 400, body: '{}' };
      return { status: 201, body: JSON.stringify({ data: { token: 'fixture-token', identityId: 17, identity: { id: 17 },
        tokenScopeList: [{ org: { id: 31 }, user: { id: 42 } }] } }) };
    }
    if (path === '/orgs/31/users/42') return { status: 200, body: JSON.stringify({ data: { id: 42,
      identity: { id: 17, email: 'employee@example.com', users: [{ id: 42, org: { id: 31, name: 'IFSS' } }] } } }) };
    if (path.endsWith('/entries')) return { status: 200, body: JSON.stringify({ filteredCount: 1, data: [
      { id: 90, name: 'COE Door', zone: { name: 'COE', site: { name: 'Main building' } } },
    ] }) };
    if (path.includes('/credentials?')) return { status: 200, body: JSON.stringify({ data: path.includes('offset=0&') ? [{ id: 71, cloudKey: { id: 701 } }] : [] }) };
    throw new Error('Unexpected native request');
  } };
  const registry = NativeModulesProxy as Record<string, unknown>;
  const previousNative = registry.LatchOpenpathTransport;
  registry.LatchOpenpathTransport = native;
  jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValue(null);
  try {
    await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
    await fireEvent.changeText(screen.getByLabelText('Email'), ' employee@example.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), ' fixture-password ');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(requests.length).toBeGreaterThan(0);
    expect(JSON.parse(requests[0].body!)).toEqual({ email: 'employee@example.com', password: ' fixture-password ', namespaceNickname: 'org:ifss-group' });
    expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
    expect(requests.some(({ path }) => path.endsWith('/cloudKeyEntryUnlock'))).toBe(false);
  } finally {
    if (previousNative === undefined) delete registry.LatchOpenpathTransport; else registry.LatchOpenpathTransport = previousNative;
    if (previousMode === undefined) delete process.env.EXPO_PUBLIC_LATCH_MODE; else process.env.EXPO_PUBLIC_LATCH_MODE = previousMode;
    if (previousNamespace === undefined) delete process.env.EXPO_PUBLIC_ALTA_NAMESPACE; else process.env.EXPO_PUBLIC_ALTA_NAMESPACE = previousNamespace;
  }
});

test('the EU app never restores a legacy US live token into its current provider', async () => {
  const startedAt = Date.now();
  const nativeValues = new Map([['latch.live.session.v1', JSON.stringify({ version: 1, environment: 'live',
    token: 'legacy-us-token', identityId: '17', startedAt, expiresAt: startedAt + 600_000,
    associations: [{ orgId: 31, userId: 42 }],
  })]]);
  jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (key) => nativeValues.get(key) ?? null);
  jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value) => { nativeValues.set(key, value); });
  jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async (key) => { nativeValues.delete(key); });
  const requests: OpenpathRequest[] = [];
  const provider = createOpenpath(async (request) => {
    requests.push(request);
    return { status: 200, body: JSON.stringify({ data: { id: 42, identity: { id: 17, email: 'employee@example.com',
      users: [{ id: 42, org: { id: 31, name: 'IFSS' } }] } } }) };
  });
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  expect(await screen.findByRole('header', { name: 'Sign in to Latch' })).toBeOnTheScreen();
  expect(requests).toEqual([]);
  expect(nativeValues.has('latch.live.session.v1')).toBe(true);
});

beforeEach(() => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
});

test('an invalid app link shows Latch guidance and returns to sign-in without exposing route tools', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen, '+not-found': NotFoundScreen }, { initialUrl: '/missing-door-link' });
  expect(screen.getByRole('header', { name: 'This Latch screen is unavailable' })).toBeOnTheScreen();
  expect(screen.queryByText('Unmatched Route')).not.toBeOnTheScreen();
  expect(screen.queryByText('Sitemap')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Return to Latch' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
});

test('a screen failure shows safe Latch recovery instead of a framework error screen', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  let failed = true;
  function InitialScreen() {
    if (failed) throw new Error('fixture raw failure details');
    return <HomeScreen />;
  }
  await renderRouter({ _layout: { default: RootLayout, ErrorBoundary }, index: InitialScreen, door: DoorScreen });
  expect(screen.getByRole('header', { name: 'Latch could not display this screen' })).toBeOnTheScreen();
  expect(screen.queryByText(/fixture raw failure details/)).not.toBeOnTheScreen();
  expect(screen.queryByText('Sitemap')).not.toBeOnTheScreen();
  failed = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
});

test('cold launch shows the Latch branding, reveals sign-in, and does not replay on foreground', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  let onChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') onChange = listener;
    return { remove() {} };
  });
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  expect(screen.getByLabelText('Latch is starting')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: 'Sign in' }, { timeout: 2000 })).toBeOnTheScreen();
  expect(screen.queryByLabelText('Latch is starting')).not.toBeOnTheScreen();
  await act(async () => { onChange?.('background'); onChange?.('active'); });
  expect(screen.queryByLabelText('Latch is starting')).not.toBeOnTheScreen();
});

afterEach(async () => {
  await act(async () => { toast.dismiss(); });
  jest.restoreAllMocks();
});

test('the opt-in demo verification control sends an identifiable error through the app without signing in or unlocking', async () => {
  process.env.EXPO_PUBLIC_SENTRY_VERIFY = '1';
  jest.mocked(Sentry.captureException).mockClear();
  try {
    await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
    await fireEvent.press(screen.getByRole('button', { name: 'Send Sentry test error' }));
    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/^Latch Sentry verification \d{13}$/) })));
    expect(screen.queryByRole('button', { name: 'Unlock COE Door' })).not.toBeOnTheScreen();
  } finally { delete process.env.EXPO_PUBLIC_SENTRY_VERIFY; }
});

test('the actual live journey offers TOTP up front and reports API acceptance without claiming physical opening', async () => {
  const requests: OpenpathRequest[] = [];
  const provider = createOpenpath(async (request) => {
    requests.push(request);
    if (request.path.endsWith('/cloudKeyEntryUnlock')) return { status: 204, body: '' };
    let response: unknown;
    if (request.path === '/auth/login') response = { data: { token: 'fixture-token', identityId: 17, identity: { id: 17 },
      tokenScopeList: [{ org: { id: 31, name: 'IFSS' }, user: { id: 42 } }] } };
    else if (request.path === '/orgs/31/users/42') response = { data: { id: 42, identity: { id: 17, email: 'employee@example.com',
      users: [{ id: 42, org: { id: 31, name: 'IFSS' } }] } } };
    else if (request.path.endsWith('/entries')) response = { filteredCount: 1, data: [
      { id: 90, name: 'COE Door', zone: { id: 8, name: 'COE', site: { id: 9, name: 'Main building' } } },
    ] };
    else if (request.path.includes('/credentials?')) response = { data: request.path.includes('offset=0&') ? [{ id: 71, cloudKey: { id: 701 } }] : [] };
    else throw new Error('Unexpected HTTP request');
    return { status: request.path === '/auth/login' ? 201 : 200, body: JSON.stringify(response) };
  });
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  expect(screen.getByRole('header', { name: 'Sign in to Latch' })).toBeOnTheScreen();
  expect(screen.queryByText('Demo mode — simulated access')).not.toBeOnTheScreen();
  expect(screen.queryByText(/MFA demo:/)).not.toBeOnTheScreen();
  expect(screen.queryByText(/Organisation and door choices:/)).not.toBeOnTheScreen();
  expect(screen.queryByText(/demo@latch/)).not.toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Email'), 'employee@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'fixture-password');
  await fireEvent.press(screen.getByRole('button', { name: 'Use authenticator code' }));
  expect(requests).toEqual([]);
  expect(screen.queryByLabelText('Email')).not.toBeOnTheScreen();
  expect(screen.queryByLabelText('Password')).not.toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '000000');
  await fireEvent.press(screen.getByRole('button', { name: 'Edit sign-in details' }));
  expect(screen.getByLabelText('Email')).toHaveDisplayValue('employee@example.com');
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('fixture-password');
  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Use authenticator code' }));
  expect(screen.getByLabelText('Authenticator code')).toHaveDisplayValue('');
  await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '654321');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify and sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  expect(screen.getByText('This requests a real door unlock using your Alta permissions.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Unlock request accepted. Door position has not been confirmed.')).toBeOnTheScreen();
  expect(requests.filter(({ path }) => path.endsWith('/cloudKeyEntryUnlock'))).toHaveLength(1);
  expect(requests[0].body).toMatchObject({ email: 'employee@example.com', password: 'fixture-password', mfa: { totpCode: '654321' } });
});

test('an explicitly live build without its native client cannot silently use the demo account', async () => {
  const previous = process.env.EXPO_PUBLIC_LATCH_MODE;
  process.env.EXPO_PUBLIC_LATCH_MODE = 'live';
  try {
    await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
    expect(screen.getByRole('header', { name: 'Sign in to Latch' })).toBeOnTheScreen();
    expect(screen.queryByText('Demo mode — simulated access')).not.toBeOnTheScreen();
    expect(screen.queryByText(/demo@latch/)).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Unable to sign in')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Unlock COE Door' })).not.toBeOnTheScreen();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_LATCH_MODE;
    else process.env.EXPO_PUBLIC_LATCH_MODE = previous;
  }
});

test('an unresolved unlock does not prevent local sign-out through its confirmation modal', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'uncertain@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
  await screen.findByRole('button', { name: 'Acknowledge result' });
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
});

test('demo launch identifies simulated access and offers sign-in without an unlock action', async () => {
  await renderRouter(
    { _layout: RootLayout, index: HomeScreen, door: DoorScreen },
    { initialUrl: '/' },
  );

  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  expect(screen.getByText('BUILDING ACCESS')).toBeOnTheScreen();
  expect(screen.queryByText('COE ACCESS')).not.toBeOnTheScreen();
  expect(screen.queryByText('latch')).not.toBeOnTheScreen();
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

test('a pending sign-in preserves its password and a failed request leaves it available to correct', async () => {
  let requests = 0;
  let finish!: (response: { status: number; body: string }) => void;
  const response = new Promise<{ status: number; body: string }>((resolve) => { finish = resolve; });
  const provider = createOpenpath(async () => { requests++; return response; });
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'employee@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'draft-password');
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(screen.getByLabelText('Password')).toHaveDisplayValue('draft-password');
  expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  expect(screen.getByLabelText('Password')).toHaveProp('editable', false);
  expect(screen.getByRole('button', { name: 'Signing in…', busy: true })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Signing in…' }));
  expect(requests).toBe(1);
  await act(async () => { finish({ status: 400, body: '{}' }); });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Sign-in failed\./);
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('draft-password');
  expect(screen.getByLabelText('Password')).toHaveProp('editable', true);
  expect(screen.getByRole('button', { name: 'Sign in', busy: false })).toBeEnabled();
});

test('failed sign-in shows a toast and keeps recovery guidance on the form', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'incorrect-password');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Unable to sign in')).toBeOnTheScreen();
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed. Check the demo account details.');
  expect(screen.getByLabelText('Password')).toHaveDisplayValue('incorrect-password');
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
  expect(screen.queryByText('demo@latch.example')).not.toBeOnTheScreen();
  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  expect(screen).toHavePathname('/door');

  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));

  const modal = await screen.findByTestId('app-modal');
  expect(within(modal).getByRole('header', { name: 'Your account' })).toBeOnTheScreen();
  expect(within(modal).getByText('demo@latch.example')).toBeOnTheScreen();
  expect(within(modal).getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  expect(screen).toHavePathname('/door');
  await fireEvent.press(within(modal).getByRole('button', { name: 'Sign out' }));

  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
});

test('cancelling sign out keeps the employee signed in with door access', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('button', { name: 'Unlock COE Door' });
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));

  const modal = await screen.findByTestId('app-modal');
  await fireEvent.press(within(modal).getByRole('button', { name: 'Cancel' }));

  await waitFor(() => expect(screen.queryByTestId('app-modal')).not.toBeOnTheScreen());
  expect(screen).toHavePathname('/door');
  expect(screen.queryByText('demo@latch.example')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Account' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('the employee selects an organisation and a distinguishable COE door before confirming unlock', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'multi@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('header', { name: 'Choose an organisation' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Engineering demo' }));
  expect(await screen.findByRole('header', { name: 'Choose COE Door' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'COE Door · South building · COE' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock COE Door' }));
  const modal = await screen.findByTestId('app-modal');
  expect(within(modal).getByText('Engineering demo · South building · COE')).toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([]);
  await fireEvent.press(within(modal).getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Simulated unlock accepted')).toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([{ orgId: 606, userId: 707, entryId: 809, credentialId: 404 }]);
  await fireEvent.press(screen.getByRole('button', { name: 'Change organisation' }));
  expect(await screen.findByRole('header', { name: 'Choose an organisation' })).toBeOnTheScreen();
  expect(screen.queryByText('Simulated unlock accepted. No physical door was operated.')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'IFSS demo' }));
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(screen.getByText('IFSS demo · Demo building · COE')).toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toHaveLength(1);
});

test('pulling down refreshes door access while preserving content and never requesting an unlock', async () => {
  const base = createMockOpenpath();
  let refreshing = false;
  let refreshReads = 0;
  let finish!: (entries: Entry[]) => void;
  const response = new Promise<Entry[]>((resolve) => { finish = resolve; });
  const provider = { ...base, async listUserEntries(context: Parameters<typeof base.listUserEntries>[0]) {
    if (refreshing) { refreshReads++; return response; }
    return base.listUserEntries(context);
  } };
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('button', { name: 'Unlock COE Door' });
  refreshing = true;

  await fireEvent(screen.getByLabelText('Refresh door access'), 'refresh');

  expect(screen.getByText('IFSS demo · Demo building · COE')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Refresh access' })).not.toBeOnTheScreen();
  await fireEvent(screen.getByLabelText('Refresh door access'), 'refresh');
  expect(refreshReads).toBe(1);
  await act(async () => { finish([{ id: 303, name: 'COE Door', site: 'Assessment building', zone: 'COE' }]); });
  expect(await screen.findByText('IFSS demo · Assessment building · COE')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeEnabled();
  expect(base.getUnlockRequests()).toEqual([]);
});

test('pulling down preserves the selected COE door when it is still available', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'multi@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Engineering demo' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'COE Door · South building · COE' }));

  await fireEvent(screen.getByLabelText('Refresh door access'), 'refresh');

  await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeEnabled());
  expect(screen.getByText('Engineering demo · South building · COE')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Choose COE Door' })).not.toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('missing-key demo access explains the problem and refreshes without requesting an unlock', async () => {
  const provider = createMockOpenpath();
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'no-key@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Exactly one currently valid Cloud Key is required\./);
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Exactly one currently valid Cloud Key is required\./);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled());
  expect(provider.getUnlockRequests()).toEqual([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(screen).toHavePathname('/'));
});

test('refresh recovers from denied discovery without automatically requesting an unlock', async () => {
  const base = createMockOpenpath();
  let denied = true;
  const provider = { ...base, async listUserEntries(context: Parameters<typeof base.listUserEntries>[0]) {
    if (denied) throw new AccessError('access-denied');
    return base.listUserEntries(context);
  } };
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Door access is unavailable for this account\./);
  denied = false;

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(base.getUnlockRequests()).toEqual([]);
});

test('a removed entry requires refreshed access and a fresh confirmation without dispatching', async () => {
  const base = createMockOpenpath();
  let removed = false;
  const provider = { ...base, async listUserEntries(context: Parameters<typeof base.listUserEntries>[0]) {
    return removed ? [] : base.listUserEntries(context);
  } };
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  removed = true;
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));

  expect(await screen.findByRole('alert', { name: /^COE Door access is unavailable/ })).toHaveTextContent(/Door access has changed/);
  expect(screen.queryByText("We couldn't confirm the result. Check before trying again.")).not.toBeOnTheScreen();
  expect(base.getUnlockRequests()).toEqual([]);
  removed = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  expect(base.getUnlockRequests()).toEqual([]);
});

test('an unlock failure shows a warning toast and preserves the uncertain result after dismissal', async () => {
  jest.mocked(Sentry.logger.warn).mockClear();
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
  expect(Sentry.logger.warn).toHaveBeenCalledWith('Latch unlock outcome', { 'latch.operation': 'unlock', 'latch.result': 'unknown' });
  expect(screen.getByRole('button', { name: 'Acknowledge result' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeDisabled();
  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
  expect(screen.queryByText('Provider details should not be displayed.')).not.toBeOnTheScreen();
});

test('acknowledgement and refresh never send another unlock without a fresh confirmation', async () => {
  let time = 1_800_000;
  let lost = true;
  const base = createMockOpenpath();
  const provider = { ...base, async unlockEntry(command: Parameters<typeof base.unlockEntry>[0]) {
    await base.unlockEntry(command); if (lost) throw new Error('Lost response');
  } };
  const Layout = () => <RootLayout provider={provider} now={() => time} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));
  await screen.findByRole('button', { name: 'Acknowledge result' });
  await fireEvent(screen.getByLabelText('Refresh door access'), 'refresh');
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Acknowledge result' })).toBeEnabled());
  expect(base.getUnlockRequests()).toHaveLength(1);
  time += 3000;
  lost = false;

  await fireEvent.press(screen.getByRole('button', { name: 'Acknowledge result' }));
  expect(await screen.findByText('Acknowledgement saved. A new request still needs confirmation.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeEnabled();
  expect(base.getUnlockRequests()).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Unlock COE Door' }));
  expect(base.getUnlockRequests()).toHaveLength(1);
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Simulated unlock accepted')).toBeOnTheScreen();
  expect(base.getUnlockRequests()).toHaveLength(2);
});

test('the uncertain demo requires acknowledgement instead of claiming an accepted unlock', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'uncertain@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));

  expect(await screen.findByRole('button', { name: 'Acknowledge result' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeDisabled();
  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
});

test('an unlock denial stays distinct from an unknown result in the demo UI', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'unlock-denied@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));

  expect(await screen.findByText('The provider denied the unlock request.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Acknowledge result' })).not.toBeOnTheScreen();
  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
});

test('offline preflight reports not sent and reconnection does not queue an unlock', async () => {
  const base = createMockOpenpath();
  let offline = false;
  const provider = { ...base, async listUserEntries(context: Parameters<typeof base.listUserEntries>[0]) {
    if (offline) throw new Error('Raw connection details');
    return base.listUserEntries(context);
  } };
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  offline = true;
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Unlock request not sent')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Acknowledge result' })).not.toBeOnTheScreen();
  expect(base.getUnlockRequests()).toEqual([]);
  offline = false;

  await fireEvent(screen.getByLabelText('Refresh door access'), 'refresh');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock COE Door' })).toBeEnabled());
  expect(base.getUnlockRequests()).toEqual([]);
});

test('native interruption and restart restore the employee’s unknown result without replaying it', async () => {
  const nativeValues = new Map<string, string>();
  jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (key) => nativeValues.get(key) ?? null);
  jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value) => { nativeValues.set(key, value); });
  jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async (key) => { nativeValues.delete(key); });
  let onChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') onChange = listener;
    return { remove() {} };
  });
  let finish!: () => void;
  let started!: () => void;
  const dispatched = new Promise<void>((resolve) => { started = resolve; });
  const response = new Promise<void>((resolve) => { finish = resolve; });
  const base = createMockOpenpath();
  const provider = { ...base, async unlockEntry(command: Parameters<typeof base.unlockEntry>[0]) {
    await base.unlockEntry(command); started(); await response;
  } };
  const Layout = () => <RootLayout provider={provider} />;
  const first = await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));
  await fireEvent.press(within(await screen.findByTestId('app-modal')).getByRole('button', { name: 'Unlock' }));
  await dispatched;
  expect(screen.getByRole('button', { name: 'Requesting unlock…' })).toBeDisabled();
  await fireEvent(screen.getByLabelText('Refresh door access'), 'refresh');
  expect(screen.getByRole('button', { name: 'Requesting unlock…' })).toBeDisabled();
  expect(base.getUnlockRequests()).toHaveLength(1);
  await act(async () => { onChange?.('background'); onChange?.('active'); });
  expect(await screen.findByRole('button', { name: 'Acknowledge result' })).toBeOnTheScreen();
  await act(async () => { finish(); });
  expect(screen.queryByText('Simulated unlock accepted')).not.toBeOnTheScreen();
  await first.unmount();

  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  expect(await screen.findByRole('button', { name: 'Acknowledge result' })).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeDisabled();
  expect(base.getUnlockRequests()).toHaveLength(1);
  const journal = nativeValues.get('latch.demo.attempts.v1');
  expect(journal).toBeDefined();
  expect(journal).not.toContain('simulated-session:');
  expect(journal).not.toContain('latch-demo-only');
});

test('unavailable door access shows an error toast while unlock remains unavailable', async () => {
  const provider = createMockOpenpath({ entries: [] });
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  await fireEvent.press(await screen.findByRole('button', { name: /COE access unavailable/ }));

  expect(screen.getByRole('alert')).toHaveTextContent(/COE Door access is unavailable\./);
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('the employee can complete demo MFA after correcting an invalid authenticator code', async () => {
  await renderRouter({ _layout: RootLayout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'mfa@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByLabelText('Authenticator code')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Verify your sign-in' })).toBeOnTheScreen();
  expect(screen.queryByLabelText('Email')).not.toBeOnTheScreen();
  expect(screen.queryByLabelText('Password')).not.toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '000000');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify and sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That authenticator code was not accepted. Enter a new code.');
  expect(screen.getByLabelText('Authenticator code')).toHaveDisplayValue('');
  expect(screen.queryByLabelText('Password')).not.toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify and sign in' }));

  expect(await screen.findByRole('button', { name: 'Unlock COE Door' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  expect(within(await screen.findByTestId('app-modal')).getByText('mfa@latch.example')).toBeOnTheScreen();
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

test('cancelling pending MFA clears its secrets and ignores the late successful response', async () => {
  const base = createMockOpenpath();
  let finish!: (session: ProviderSession) => void;
  const response = new Promise<ProviderSession>((resolve) => { finish = resolve; });
  const provider = { ...base, async login(input: Parameters<typeof base.login>[0]) {
    return input.totpCode ? response : base.login(input);
  } };
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'mfa@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.changeText(await screen.findByLabelText('Authenticator code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify and sign in' }));
  expect(screen.getByRole('button', { name: 'Verifying…', busy: true })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel sign-in' }));
  await act(async () => { finish(await base.login({ email: 'mfa@latch.example', password: 'latch-demo-only', totpCode: '123456' })); });

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
  await fireEvent.press(screen.getByRole('button', { name: 'Verify and sign in' }));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  expect(within(await screen.findByTestId('app-modal')).getByText('mfa@latch.example')).toBeOnTheScreen();
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
