import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLatch } from '@/services/latch-context';
import { AccessBackdrop } from '@/components/access-backdrop';
import { Brand, brandMarkSvg } from '@/constants/branding';
import { useTheme } from '@/hooks/use-theme';

export function AccessScreen({ children, backdrop = 'none' }: PropsWithChildren<{ backdrop?: 'none' | 'static' | 'animated' }>) {
  const { environment } = useLatch();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <ThemedView style={{ flex: 1 }}>
      {backdrop !== 'none' ? <AccessBackdrop animate={backdrop === 'animated'} /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + Spacing.five, paddingLeft: insets.left + Spacing.four, paddingRight: insets.right + Spacing.four }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four }}>
          <View accessible accessibilityRole="image" accessibilityLabel="Latch" style={{ alignSelf: 'flex-start', marginLeft: -14 }}>
            <SvgXml xml={brandMarkSvg.replaceAll(Brand.foreground, theme.text)} width={64} height={64} />
          </View>
          {environment === 'demo' ? <ThemedText selectable themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>Demo mode — simulated access</ThemedText> : null}
          {children}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
