require('react-native-reanimated').setUpTests();

// The preset's RefreshControl stub drops props and gesture callbacks. Exercise
// the real JS control with the preset's native bridge instead.
jest.unmock('react-native/Libraries/Components/RefreshControl/RefreshControl');

// Substitute only the external/native Sentry SDK. Latch's telemetry policy and
// operation instrumentation stay real; no test can send monitoring traffic.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), wrap: (component) => component,
  expoRouterIntegration: jest.fn(() => ({ name: 'ExpoRouter' })),
  reactNativeTracingIntegration: jest.fn(() => ({ name: 'ReactNativeTracing' })),
  startInactiveSpan: jest.fn(() => ({ end: jest.fn(), setStatus: jest.fn() })),
  captureException: jest.fn(),
  getClient: jest.fn(() => ({ getOptions: () => ({ enabled: true }) })),
  flush: jest.fn(async () => true),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
