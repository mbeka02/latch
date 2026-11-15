import { type PropsWithChildren, useEffect } from 'react';
import { Pressable, useColorScheme, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toaster, toast } from 'sonner-native';

import { useLatch } from '@/services/latch-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export function Notifications() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const toastWidth = Math.max(0, Math.min(MaxContentWidth, width - 2 * Math.max(insets.left, insets.right) - Spacing.three * 2));
  const { session } = useLatch();
  useEffect(() => { toast.dismiss(); }, [session]);
  return (
    <Toaster
      theme={colorScheme === 'dark' ? 'dark' : 'light'}
      duration={5000}
      visibleToasts={1}
      position="top-center"
      toastOptions={{ style: { width: toastWidth, alignSelf: 'center' } }}
      ToastWrapper={DismissibleNotification}
    />
  );
}

function DismissibleNotification({ toastId, children }: PropsWithChildren<{ toastId: string | number }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Dismiss notification"
      style={{ width: '100%', alignSelf: 'stretch' }}
      onPress={() => toast.dismiss(toastId)}>
      {children}
    </Pressable>
  );
}
