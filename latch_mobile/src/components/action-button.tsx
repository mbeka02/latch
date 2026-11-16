import { ActivityIndicator, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AccessLayout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ActionButton({ label, accessibilityLabel, onPress, disabled = false, loading = false, compact = false, secondary = false, quiet = false }: {
  label: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  secondary?: boolean;
  quiet?: boolean;
}) {
  const theme = useTheme();
  const foreground = quiet ? theme.textSecondary : secondary ? theme.text : theme.actionText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{ color: theme.backgroundSelected }}
      style={({ pressed }) => ({
        minHeight: compact ? 48 : 56,
        minWidth: compact ? 88 : undefined,
        maxWidth: '100%',
        paddingHorizontal: Spacing.three,
        paddingVertical: compact ? Spacing.two : Spacing.three,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.two,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: AccessLayout.controlRadius,
        opacity: loading ? 1 : disabled ? 0.5 : pressed ? 0.8 : 1,
        backgroundColor: quiet ? 'transparent' : secondary ? theme.backgroundElement : theme.action,
      })}>
      {loading ? <ActivityIndicator size="small" color={foreground} accessible={false} importantForAccessibility="no-hide-descendants" /> : null}
      <ThemedText style={{ color: foreground, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</ThemedText>
    </Pressable>
  );
}
