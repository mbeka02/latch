import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import HomeScreen from '@/app/index';
import DoorScreen from '@/app/door';
import { createMockOpenpath } from '@/services/mocks/openpath';

afterEach(() => jest.restoreAllMocks());

test('demo launch identifies simulated access and offers sign-in without an unlock action', async () => {
  await renderRouter(
    { _layout: RootLayout, index: HomeScreen, door: DoorScreen },
    { initialUrl: '/' },
  );

  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
});

test('cancelling the native confirmation leaves the simulated door unrequested', async () => {
  const provider = createMockOpenpath();
  const nativeAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));

  expect(nativeAlert.mock.lastCall?.[0]).toBe('Unlock COE Door?');
  const cancel = nativeAlert.mock.lastCall?.[2]?.find((button) => button.text === 'Cancel');
  expect(cancel).toBeDefined();
  await act(async () => { cancel?.onPress?.(); });

  expect(provider.getUnlockRequests()).toEqual([]);
  expect(screen.queryByText('Simulated unlock accepted. No physical door was operated.')).not.toBeOnTheScreen();
});

test('confirming unlock reports simulated acceptance and sends the discovered request', async () => {
  const provider = createMockOpenpath();
  const nativeAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const Layout = () => <RootLayout provider={provider} />;
  await renderRouter({ _layout: Layout, index: HomeScreen, door: DoorScreen });
  await fireEvent.changeText(screen.getByLabelText('Email'), 'demo@latch.example');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'latch-demo-only');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Unlock COE Door' }));

  expect(provider.getUnlockRequests()).toEqual([]);
  expect(nativeAlert.mock.lastCall?.[1]).toContain('IFSS demo · Demo building · COE');
  const unlock = nativeAlert.mock.lastCall?.[2]?.find((button) => button.text === 'Unlock');
  expect(unlock).toBeDefined();
  await act(async () => { unlock?.onPress?.(); });

  expect(await screen.findByText('Simulated unlock accepted. No physical door was operated.')).toBeOnTheScreen();
  expect(provider.getUnlockRequests()).toEqual([
    { orgId: 101, userId: 202, entryId: 303, credentialId: 404 },
  ]);
  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
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
