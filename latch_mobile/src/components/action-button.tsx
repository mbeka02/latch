import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AccessLayout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ActionButton({ label, onPress, disabled = false, secondary = false, quiet = false }: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  quiet?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: theme.backgroundSelected }}
      style={({ pressed }) => ({
        minHeight: 56,
        padding: Spacing.three,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: AccessLayout.controlRadius,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        backgroundColor: quiet ? 'transparent' : secondary ? theme.backgroundElement : theme.action,
      })}>
      <ThemedText style={{ color: quiet ? theme.textSecondary : secondary ? theme.text : theme.actionText, fontWeight: '600' }}>{label}</ThemedText>
    </Pressable>
  );
}
