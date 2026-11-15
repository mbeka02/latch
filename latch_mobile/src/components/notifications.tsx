import { type PropsWithChildren, useEffect } from 'react';
import { Pressable, useColorScheme } from 'react-native';
import { Toaster, toast } from 'sonner-native';

import { useLatch } from '@/services/latch-context';

export function Notifications() {
  const colorScheme = useColorScheme();
  const { session } = useLatch();
  useEffect(() => { toast.dismiss(); }, [session]);
  return (
    <Toaster
      theme={colorScheme === 'dark' ? 'dark' : 'light'}
      duration={5000}
      visibleToasts={1}
      ToastWrapper={DismissibleNotification}
    />
  );
}

function DismissibleNotification({ toastId, children }: PropsWithChildren<{ toastId: string | number }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Dismiss notification"
      onPress={() => toast.dismiss(toastId)}>
      {children}
    </Pressable>
  );
}
