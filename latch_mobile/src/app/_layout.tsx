import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useColorScheme } from 'react-native';

import type { Openpath } from '@/lib/openpath';
import { LatchProvider, useLatch } from '@/services/latch-context';

export default function RootLayout({ provider }: { provider?: Openpath } = {}) {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LatchProvider provider={provider}>
        <SessionStack />
      </LatchProvider>
    </ThemeProvider>
  );
}

function SessionStack() {
  const { session } = useLatch();
  return (
    <Stack>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="index" options={{ title: 'Sign in to Latch' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="door" options={{ title: 'Door access' }} />
      </Stack.Protected>
    </Stack>
  );
}
