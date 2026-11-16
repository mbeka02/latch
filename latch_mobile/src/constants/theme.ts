// Shared light/dark colors, typography and layout tokens for Latch.

import '@/global.css';

import { Platform } from 'react-native';
import { Brand } from '@/constants/branding';
import { FontFamily } from '@/constants/fonts';

export const Colors = {
  light: {
    text: '#000000',
    background: '#F7F7F8',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    action: '#C9161D',
    actionText: '#FFFFFF',
    error: '#9F1522',
    errorSurface: '#FCEAED',
    warning: '#7A4A00',
    warningSurface: '#FFF2D8',
    inputOutline: '#767676',
    modalSurface: '#FFFFFF',
    modalOutline: '#E0E1E6',
    scrim: '#00000080',
    ambientLine: '#A4A6AC',
  },
  dark: {
    text: '#ffffff',
    background: Brand.background,
    backgroundElement: '#1C1D20',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    action: '#C9161D',
    actionText: '#FFFFFF',
    error: '#FF9A9E',
    errorSurface: '#2D181D',
    warning: '#F2C06D',
    warningSurface: '#302719',
    inputOutline: '#777B83',
    modalSurface: '#18191C',
    modalOutline: '#323438',
    scrim: '#000000A6',
    ambientLine: '#61656E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = { ...Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
}), sans: FontFamily.regular, medium: FontFamily.medium, bold: FontFamily.bold };

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 480;

export const AccessLayout = {
  controlRadius: 14,
  titleSize: 36,
  titleLineHeight: 42,
} as const;
