import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Notifications } from '@/components/notifications';
import type { Openpath } from '@/lib/openpath';
import { LatchProvider, useLatch } from '@/services/latch-context';
import type { SessionOptions } from '@/services/latch';
import { AccessScreen } from '@/components/access-screen';
import { ThemedText } from '@/components/themed-text';

export default function RootLayout({ provider, storage, now }: { provider?: Openpath } & SessionOptions = {}) {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LatchProvider provider={provider} storage={storage} now={now}>
          <SessionStack />
          <Notifications />
        </LatchProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function SessionStack() {
  const { session, authState } = useLatch();
  if (authState.status === 'restoring') return <AccessScreen><ThemedText>Checking secure session…</ThemedText></AccessScreen>;
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
