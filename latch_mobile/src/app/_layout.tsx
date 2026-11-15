import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { initializeMonitoring } from '@/monitoring/init';

import { Notifications } from '@/components/notifications';
import type { Openpath } from '@/lib/openpath';
import { LatchProvider, useLatch } from '@/services/latch-context';
import type { SessionOptions } from '@/services/latch';
import { AccessScreen } from '@/components/access-screen';
import { ThemedText } from '@/components/themed-text';
import { LaunchScreen } from '@/components/launch-screen';

export { RouteError as ErrorBoundary } from '@/components/route-error';

initializeMonitoring();

type RootLayoutProps = { provider?: Openpath } & SessionOptions;
function RootLayout({ provider, storage, attemptStorage, now }: RootLayoutProps = {}) {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LatchProvider provider={provider} storage={storage} attemptStorage={attemptStorage} now={now}>
          <LaunchScreen>
            <SessionStack />
            <Notifications />
          </LaunchScreen>
        </LatchProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const MonitoredLayout = Sentry.wrap<RootLayoutProps>(RootLayout, { touchEventBoundaryProps: { extractTextFromChildren: false } });
export default function Layout(props: RootLayoutProps = {}) {
  return <MonitoredLayout {...props} />;
}

function SessionStack() {
  const { session, authState } = useLatch();
  if (authState.status === 'restoring') return <AccessScreen><ThemedText>Checking secure session…</ThemedText></AccessScreen>;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="index" options={{ title: 'Sign in to Latch' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="door" options={{ title: 'Door access' }} />
      </Stack.Protected>
    </Stack>
  );
}
