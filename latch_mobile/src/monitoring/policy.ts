import type { ReactNativeOptions } from '@sentry/react-native';

type Configuration = { dsn?: string; development: boolean; mode: 'demo' | 'live' };
export const operations = ['login', 'session-check', 'entries', 'credentials', 'unlock'] as const;
export type MonitoredOperation = typeof operations[number];
const safeNames = new Set(operations.map((operation) => `latch.${operation}`));
function name(value?: string) { return value && safeNames.has(value) ? value : 'navigation'; }
function errorMessage(value?: string) {
  return value && (/^Latch (login|session-check|entries|credentials|unlock) failed: (unavailable|storage|attempt-storage|request-not-sent)$/.test(value) ||
    /^Latch Sentry verification \d{13}$/.test(value)) ? value : 'Application error (message omitted)';
}
function attributes(value: Record<string, unknown> = {}) {
  const safe: Record<string, string | number> = {};
  if (operations.includes(value['latch.operation'] as MonitoredOperation)) safe['latch.operation'] = value['latch.operation'] as string;
  if (typeof value['latch.result'] === 'string' && ['started', 'accepted', 'denied', 'unknown', 'not-sent', 'failed'].includes(value['latch.result'])) safe['latch.result'] = value['latch.result'];
  if (typeof value['latch.duration_ms'] === 'number' && Number.isFinite(value['latch.duration_ms']) && value['latch.duration_ms'] >= 0)
    safe['latch.duration_ms'] = value['latch.duration_ms'];
  if (typeof value['latch.stage'] === 'string' && ['transport', 'timeout', 'response-status', 'response-validation'].includes(value['latch.stage']))
    safe['latch.stage'] = value['latch.stage'];
  if (typeof value['latch.error_code'] === 'string' && ['invalid-credentials', 'mfa-required', 'mfa-invalid', 'unsupported-auth', 'access-denied', 'expired',
    'unavailable', 'storage', 'attempt-storage', 'request-not-sent'].includes(value['latch.error_code']))
    safe['latch.error_code'] = value['latch.error_code'];
  const status = value['http.response.status_code'];
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599)
    safe['http.response.status_code'] = status;
  return safe;
}

export function monitoringOptions({ dsn, development, mode }: Configuration): ReactNativeOptions {
  return {
    dsn, enabled: !!dsn,
    environment: `${development ? 'development' : 'production'}-${mode}`,
    sendDefaultPii: false,
    tracesSampleRate: development ? 1 : 0.1,
    attachScreenshot: false, attachViewHierarchy: false,
    maxBreadcrumbs: 0, beforeBreadcrumb: () => null,
    enableLogs: true, enableAutoConsoleLogs: false, logsOrigin: 'js',
    enableCaptureFailedRequests: false, tracePropagationTargets: [],
    enableUserInteractionTracing: false,
    beforeSend(event) {
      return {
        type: event.type, event_id: event.event_id, timestamp: event.timestamp, platform: event.platform,
        level: event.level, release: event.release, dist: event.dist, environment: event.environment,
        sdk: event.sdk, debug_meta: event.debug_meta,
        exception: { values: event.exception?.values?.map((exception) => ({
          type: ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'AccessError'].includes(exception.type ?? '') ? exception.type : 'Error',
          value: errorMessage(exception.value),
          mechanism: exception.mechanism ? { type: exception.mechanism.type, handled: exception.mechanism.handled } : undefined,
          stacktrace: { frames: exception.stacktrace?.frames?.map((frame) => ({
            filename: frame.filename?.split(/[?#]/)[0], function: frame.function,
            lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
          })) },
        })) },
      };
    },
    beforeSendTransaction(event) {
      const trace = event.contexts?.trace;
      return {
        event_id: event.event_id, type: event.type, timestamp: event.timestamp, start_timestamp: event.start_timestamp,
        release: event.release, dist: event.dist, environment: event.environment, transaction: name(event.transaction),
        contexts: trace ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id, parent_span_id: trace.parent_span_id, op: 'app.operation', status: trace.status } } : undefined,
        spans: event.spans?.map((span) => ({ trace_id: span.trace_id, span_id: span.span_id, parent_span_id: span.parent_span_id,
          start_timestamp: span.start_timestamp, timestamp: span.timestamp, op: 'app.operation',
          description: name(span.description), status: span.status, data: attributes(span.data) })),
        tags: { 'latch.mode': mode },
      };
    },
    beforeSendLog(log) {
      if (!['Latch operation started', 'Latch operation completed', 'Latch operation failed', 'Latch unlock outcome'].includes(log.message)) return null;
      const safe = attributes(log.attributes);
      safe['sentry.environment'] = `${development ? 'development' : 'production'}-${mode}`;
      const release = log.attributes?.['sentry.release'];
      if (typeof release === 'string' && /^com\.mbeka02\.latch@\d+\.\d+\.\d+\+\d+$/.test(release)) safe['sentry.release'] = release;
      return { level: log.level, message: log.message, severityNumber: log.severityNumber, attributes: safe };
    },
    beforeSendSpan(span) {
      return { trace_id: span.trace_id, span_id: span.span_id, parent_span_id: span.parent_span_id,
        start_timestamp: span.start_timestamp, timestamp: span.timestamp, op: 'app.operation',
        description: name(span.description), status: span.status, data: attributes(span.data) };
    },
  };
}
