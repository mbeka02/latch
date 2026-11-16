import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { AccessLayout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function InlineMessage({ children, tone = 'error' }: PropsWithChildren<{ tone?: 'error' | 'warning' }>) {
  const theme = useTheme();
  const color = tone === 'error' ? theme.error : theme.warning;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two,
      padding: Spacing.three, borderRadius: AccessLayout.controlRadius,
      backgroundColor: tone === 'error' ? theme.errorSurface : theme.warningSurface }}>
      <SymbolView name={{ ios: tone === 'error' ? 'exclamationmark.circle' : 'exclamationmark.triangle',
        android: tone === 'error' ? 'error_outline' : 'warning_amber',
        web: tone === 'error' ? 'error_outline' : 'warning_amber' }}
        size={22} tintColor={color} accessible={false} importantForAccessibility="no-hide-descendants" />
      <ThemedText selectable accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={{ flex: 1, color, fontWeight: '600' }}>{children}</ThemedText>
    </View>
  );
}
