export const FontFamily = {
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  bold: 'SpaceGrotesk-Bold',
} as const;

// Static faces avoid platform-dependent synthetic weights and need no network.
export const fontAssets = {
  [FontFamily.regular]: require('@/assets/fonts/SpaceGrotesk-Regular.ttf'),
  [FontFamily.medium]: require('@/assets/fonts/SpaceGrotesk-Medium.ttf'),
  [FontFamily.bold]: require('@/assets/fonts/SpaceGrotesk-Bold.ttf'),
};
