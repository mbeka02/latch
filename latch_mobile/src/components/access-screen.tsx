import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export function AccessScreen({ children }: PropsWithChildren) {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ flexGrow: 1, padding: Spacing.four }}>
        <ThemedView style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three }}>
          <ThemedText selectable>Demo mode — simulated access</ThemedText>
          {children}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
