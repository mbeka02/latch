import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLatch } from '@/services/latch-context';

export function AccessScreen({ children }: PropsWithChildren) {
  const { environment } = useLatch();
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ flexGrow: 1, padding: Spacing.four }}>
        <ThemedView style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three }}>
          <ThemedText selectable>{environment === 'demo' ? 'Demo mode — simulated access' : 'Alta access — live requests'}</ThemedText>
          {children}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
