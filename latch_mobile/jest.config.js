/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/android',
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Exercise Sonner's actual renderer; its published entry is ESM.
  transformIgnorePatterns: require('jest-expo/jest-preset').transformIgnorePatterns.map((pattern) =>
    pattern.replace('standard-navigation', 'standard-navigation|sonner-native'),
  ),
  moduleNameMapper: {
    '\\.css$': '<rootDir>/scripts/jest-style-mock.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  watchman: false,
};
