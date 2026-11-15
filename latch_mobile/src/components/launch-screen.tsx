import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';

import { Brand, brandMarkSvg } from '@/constants/branding';
import { Fonts } from '@/constants/theme';

// Hold the native image until React has laid out the matching branded surface.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export function LaunchScreen({ children }: PropsWithChildren) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(!reducedMotion);
  const hiddenNative = useRef(false);

  function hideNativeSplash() {
    if (hiddenNative.current) return;
    hiddenNative.current = true;
    // Expo Go/web may not own a native launch screen. Never block access on it.
    try { SplashScreen.hide(); } catch {}
  }

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), Brand.launchDuration);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <View style={styles.root} onLayout={hideNativeSplash}>
      <View style={styles.root} accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {visible && (
        <Animated.View
          accessibilityLabel="Latch is starting"
          accessibilityRole="progressbar"
          accessible
          style={[styles.overlay, {
            animationName: { '0%': { opacity: 1 }, '65%': { opacity: 1 }, '100%': { opacity: 0 } },
            animationDuration: Brand.launchDuration,
            animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
            animationFillMode: 'forwards',
          }]}>
          <View style={styles.mark}>
            <SvgXml xml={brandMarkSvg} width="100%" height="100%" />
          </View>
          <Animated.View style={[styles.wordmark, {
            animationName: { from: { opacity: 0, transform: [{ translateY: 6 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
            animationDuration: 240,
            animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
          }]}>
            <Text style={styles.name}>latch</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: Brand.background, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  mark: { width: 200, height: 200 },
  wordmark: { position: 'absolute', top: '50%', marginTop: 92, alignItems: 'center' },
  name: { color: Brand.foreground, fontSize: 46, fontFamily: Fonts.bold, letterSpacing: -1 },
});
