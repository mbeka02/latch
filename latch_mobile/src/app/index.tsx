import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, padding: Spacing.four }}>
        <ThemedView
          style={{
            width: '100%',
            maxWidth: MaxContentWidth,
            alignSelf: 'center',
            gap: Spacing.three,
          }}>
          <ThemedText type="subtitle" accessibilityRole="header">
            Latch
          </ThemedText>
          <ThemedText>Demo mode — simulated access</ThemedText>
          <ThemedText themeColor="textSecondary">
            Use a demo account. No physical door will be operated.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={{
              minHeight: 56,
              padding: Spacing.three,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: Spacing.two,
              backgroundColor: theme.backgroundElement,
            }}>
            <ThemedText themeColor="textSecondary">Sign in</ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
