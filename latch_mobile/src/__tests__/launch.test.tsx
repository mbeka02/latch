import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import ExploreScreen from '@/app/explore';
import HomeScreen from '@/app/index';

test('demo launch identifies simulated access and offers sign-in without an unlock action', async () => {
  await renderRouter(
    { _layout: RootLayout, index: HomeScreen, explore: ExploreScreen },
    { initialUrl: '/' },
  );

  expect(screen.getByText('Demo mode — simulated access')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeOnTheScreen();
});
