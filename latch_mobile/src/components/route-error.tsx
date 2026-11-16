import { useEffect, useState } from 'react';
import type { ErrorBoundaryProps } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { ActionButton } from '@/components/action-button';
import { InlineMessage } from '@/components/inline-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    // The monitoring policy removes raw messages and sensitive context.
    try { Sentry.captureException(error); } catch {}
  }, [error]);
  return (
    <ThemedView style={{ flex: 1 }} onLayout={() => {
      // Also release the native splash if rendering failed before launch layout.
      try { SplashScreen.hide(); } catch {}
    }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center',
        paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four,
        paddingLeft: insets.left + Spacing.four, paddingRight: insets.right + Spacing.four }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three }}>
          <ThemedText accessibilityRole="header" type="subtitle">Latch could not display this screen</ThemedText>
          <InlineMessage>Try loading it again. If the problem continues, close and reopen Latch.</InlineMessage>
          <ActionButton label={retrying ? 'Loading…' : 'Try again'} loading={retrying} onPress={async () => {
            if (retrying) return;
            setRetrying(true);
            try { await retry(); } catch {} finally { setRetrying(false); }
          }} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}
