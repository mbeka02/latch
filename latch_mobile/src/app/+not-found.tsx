import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { AccessScreen } from '@/components/access-screen';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { useLatch } from '@/services/latch-context';

export default function NotFoundScreen() {
  const router = useRouter();
  const { session } = useLatch();
  return (
    <AccessScreen>
      <Stack.Screen options={{ title: 'Latch' }} />
      <ThemedText accessibilityRole="header" type="subtitle">This Latch screen is unavailable</ThemedText>
      <ThemedText>Return to the app to continue.</ThemedText>
      <ActionButton label="Return to Latch" onPress={() => router.replace(session ? '/door' : '/')} />
    </AccessScreen>
  );
}
