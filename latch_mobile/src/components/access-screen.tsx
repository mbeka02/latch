import type { PropsWithChildren, ReactNode } from 'react';
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

export function AccessScreen({ children, backdrop = 'none', headerActions }: PropsWithChildren<{
  backdrop?: 'none' | 'static' | 'animated';
  headerActions?: ReactNode;
}>) {
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three }}>
            <View accessible accessibilityRole="image" accessibilityLabel="Latch" style={{ marginLeft: -14 }}>
              <SvgXml xml={brandMarkSvg.replaceAll(Brand.foreground, theme.text)} width={64} height={64} />
            </View>
            {headerActions}
          </View>
          {environment === 'demo' ? <ThemedText selectable themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 18 }}>Demo mode — simulated access</ThemedText> : null}
          {children}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
