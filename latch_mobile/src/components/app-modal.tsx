import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AppModalProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose(): void;
  actions: ReactNode;
}>;

export function AppModal({ visible, title, onClose, children, actions }: AppModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [presented, setPresented] = useState(visible);
  const progress = useSharedValue(0);
  if (visible && !presented) setPresented(true);

  useEffect(() => {
    const duration = reducedMotion ? 100 : visible ? 220 : 160;
    progress.set(withTiming(visible ? 1 : 0, { duration, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    if (!visible) {
      const timer = setTimeout(() => setPresented(false), duration);
      return () => clearTimeout(timer);
    }
  }, [visible, progress, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reducedMotion ? 1 : 0.96 + progress.get() * 0.04 }],
  }));

  if (!presented) return null;
  return (
    <Modal
      testID="app-modal"
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}>
      <View style={styles.container} pointerEvents={visible ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdropStyle]}>
          <Pressable testID="modal-backdrop" accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View pointerEvents="box-none" style={[styles.safeArea, {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + Spacing.four,
          paddingLeft: insets.left + Spacing.four,
          paddingRight: insets.right + Spacing.four,
        }]}>
          <Animated.View accessibilityViewIsModal style={[styles.card, {
            backgroundColor: theme.modalSurface,
            borderColor: theme.modalOutline,
          }, cardStyle]}>
            <ScrollView bounces={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: Spacing.four }}>
              <ThemedText accessibilityRole="header" style={{ fontSize: 24, lineHeight: 32, fontWeight: '600' }}>{title}</ThemedText>
              {children}
              <View style={{ gap: Spacing.two }}>{actions}</View>
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: MaxContentWidth, maxHeight: '100%', padding: Spacing.four, borderRadius: 24, borderWidth: 1 },
});
