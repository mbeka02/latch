import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { monitoringOptions } from '@/monitoring/policy';

export function initializeMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const native = Platform.OS !== 'web' && !isRunningInExpoGo();
  try {
    Sentry.init({
      ...monitoringOptions({ dsn, development: __DEV__, mode: process.env.EXPO_PUBLIC_LATCH_MODE === 'live' ? 'live' : 'demo' }),
      release: process.env.EXPO_PUBLIC_SENTRY_RELEASE,
      enableNative: native, enableNativeNagger: false, enableNativeFramesTracking: native,
      // Automatic HTTP/touch/console context can expose credentials or IDs.
      integrations: (defaults) => defaults.filter((integration) => ![
        'Breadcrumbs', 'HttpContext', 'HttpClient', 'ConsoleLogs', 'TurboModuleContext',
        'Screenshot', 'ViewHierarchy', 'UserInteraction',
      ].includes(integration.name)).concat([
        Sentry.reactNativeTracingIntegration({ traceFetch: false, traceXHR: false, enableHTTPTimings: false }),
        Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: native }),
      ]),
    });
  } catch { /* A monitoring initialization failure cannot block door access. */ }
}
