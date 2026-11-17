import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { emptyDoorArt } from '@/constants/empty-door-art';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DoorEmptyState({ noEntries }: { noEntries: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.three }}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <SvgXml xml={emptyDoorArt(theme)} width={176} height={144} />
      </View>
      <View style={{ gap: Spacing.three, maxWidth: 400 }}>
        <ThemedText accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: '600' }}>
          {noEntries ? 'No doors returned' : 'No COE doors found'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
          {noEntries ? 'Alta returned no doors for this account.' : 'Your available doors do not include a COE match.'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {noEntries ? 'Ask IFSS to confirm your door access, or pull down to check again.'
            : 'Check the door name with IFSS, or pull down to check again.'}
        </ThemedText>
      </View>
    </View>
  );
}
