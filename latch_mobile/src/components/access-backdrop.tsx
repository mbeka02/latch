import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { Brand } from '@/constants/branding';
import { useTheme } from '@/hooks/use-theme';

// Local, decorative architecture inspired by IFSS's building imagery. No remote media.
export function AccessBackdrop({ animate }: { animate: boolean }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    if (!animate || reducedMotion) return;
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, [animate, reducedMotion]);
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, animate && !reducedMotion ? {
        animationName: { from: { transform: [{ translateY: 0 }] }, to: { transform: [{ translateY: -10 }] } },
        animationDuration: 12000,
        animationTimingFunction: 'linear',
        animationDirection: 'alternate',
        animationIterationCount: 'infinite',
        animationPlayState: active ? 'running' : 'paused',
      } : undefined]}>
        <Svg width="100%" height="100%" viewBox="0 0 480 800" preserveAspectRatio="xMidYMid slice">
          <G fill="none" stroke={theme.ambientLine} strokeWidth={0.8} opacity={0.32}>
            <Path d="M284 188V100L396 44L510 88V254M284 126L396 70L510 114M284 154L396 98L510 142M284 182L396 126L510 170M396 44V230M321 82V170M358 63V151M434 59V250M472 73V270" />
            <Path d="M232 250V190L350 134L498 192M232 216L350 160L498 218M232 244L350 188L498 246M271 172V230M310 153V211M350 134V248M399 154V265M448 173V282M180 276L490 236" />
            <Path d="M-40 698L60 658L187 724V800M-40 726L60 686L187 752M-40 754L60 714L187 780M60 658V800M18 675V800M102 680V800M144 702V800M-40 782L60 742L230 830" />
          </G>
          <G fill="none" stroke={Brand.red} strokeWidth={5} strokeLinecap="round" opacity={0.65}>
            <Path d="M412 209L423 198M428 209L439 198M444 209L455 198" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
