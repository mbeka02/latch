import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { fontAssets } from '@/constants/fonts';
import { initializeMonitoring } from '@/monitoring/init';

import { Notifications } from '@/components/notifications';
import type { Openpath } from '@/lib/openpath';
import { LatchProvider, useLatch } from '@/services/latch-context';
import type { SessionOptions } from '@/services/latch';
import { AccessScreen } from '@/components/access-screen';
import { ThemedText } from '@/components/themed-text';
import { LaunchScreen } from '@/components/launch-screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export { RouteError as ErrorBoundary } from '@/components/route-error';

initializeMonitoring();

type RootLayoutProps = { provider?: Openpath } & SessionOptions;
function RootLayout({ provider, storage, attemptStorage, now }: RootLayoutProps = {}) {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Keep the native splash during local font loading; a font error must not
  // prevent sign-in, session restoration or access to recovery controls.
  if (!fontsLoaded && !fontError) return null;
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
  const theme = useTheme();
  if (authState.status === 'restoring') return <AccessScreen><View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
    <ActivityIndicator color={theme.textSecondary} />
    <ThemedText accessibilityLiveRegion="polite">Checking secure session…</ThemedText>
  </View></AccessScreen>;
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
