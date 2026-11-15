import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/**
 * Match server-rendered HTML during hydration, then follow the system theme.
 */
export function useColorScheme() {
  return useSyncExternalStore(subscribe, Appearance.getColorScheme, getServerSnapshot);
}

function subscribe(onChange: () => void) {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
}

function getServerSnapshot() {
  return 'light' as const;
}
