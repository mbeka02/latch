import { monitoringOptions } from '@/monitoring/policy';

test('outbound errors keep diagnostic stack locations while dropping arbitrary messages and account/request data', async () => {
  const options = monitoringOptions({ dsn: 'https://public@example.com/1', development: false, mode: 'live' });
  const event = { type: undefined, event_id: 'event-1', exception: { values: [{ type: 'TypeError', value: 'password fixture-password token fixture-token',
    stacktrace: { frames: [{ filename: 'app:///src/services/openpath.ts', function: 'login', lineno: 25, colno: 4, vars: { password: 'fixture-password' } }] } }] },
    user: { email: 'private@example.com', id: '17' }, request: { url: 'https://api.openpath.com/auth/login', headers: { Authorization: 'fixture-token' }, data: { password: 'fixture-password' } },
    extra: { totpCode: '654321' }, contexts: { employee: { orgId: 31 } }, tags: { email: 'private@example.com' },
    breadcrumbs: [{ category: 'console', message: 'fixture-password' }] };
  const outbound = await options.beforeSend!(event, {});
  expect(outbound?.exception?.values?.[0]).toMatchObject({ type: 'TypeError', value: 'Application error (message omitted)',
    stacktrace: { frames: [{ filename: 'app:///src/services/openpath.ts', function: 'login', lineno: 25, colno: 4 }] } });
  const serialized = JSON.stringify(outbound);
  for (const secret of ['fixture-password', 'fixture-token', '654321', 'private@example.com', 'orgId']) expect(serialized).not.toContain(secret);
});

test('monitoring has environment-specific sampling and prevents automatic sensitive capture or trace propagation', () => {
  const production = monitoringOptions({ dsn: 'https://public@example.com/1', development: false, mode: 'live' });
  const development = monitoringOptions({ development: true, mode: 'demo' });
  expect(production).toMatchObject({ enabled: true, environment: 'production-live', tracesSampleRate: 0.1,
    sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false, maxBreadcrumbs: 0,
    enableLogs: true, enableAutoConsoleLogs: false, logsOrigin: 'js', tracePropagationTargets: [], enableCaptureFailedRequests: false });
  expect(development).toMatchObject({ enabled: false, environment: 'development-demo', tracesSampleRate: 1 });
  expect(production.beforeBreadcrumb!({ category: 'http', data: { token: 'private' } }, {})).toBeNull();
});

test('outbound traces and logs cannot carry raw URLs, identifiers or arbitrary attributes', async () => {
  const options = monitoringOptions({ dsn: 'https://public@example.com/1', development: false, mode: 'live' });
  const trace = await options.beforeSendTransaction!({ type: 'transaction', transaction: '/users/17?token=fixture-token',
    contexts: { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { password: 'fixture-password' } } },
    spans: [{ trace_id: 'a'.repeat(32), span_id: 'c'.repeat(16), start_timestamp: 1, timestamp: 2, op: 'http.client',
      description: 'POST /users/17?token=fixture-token', data: { 'http.request.body': 'fixture-password' } }],
    extra: { code: '654321' }, tags: { user: 'private@example.com' },
  }, {});
  expect(trace?.transaction).toBe('navigation');
  expect(JSON.stringify(trace)).not.toMatch(/fixture|654321|private@example|users\/17/);
  const log = { level: 'info' as const, message: 'Latch operation completed', timestamp: 1, attributes: {
    'latch.operation': 'login', 'latch.result': 'accepted', email: 'private@example.com', password: 'fixture-password',
  } };
  const outbound = options.beforeSendLog!(log);
  expect(outbound?.attributes).toEqual({ 'latch.operation': 'login', 'latch.result': 'accepted', 'sentry.environment': 'production-live' });
  expect(options.beforeSendLog!({ ...log, message: 'password fixture-password' })).toBeNull();
  expect(options.beforeSendLog!({ ...log, message: 'Latch unlock outcome' })?.message).toBe('Latch unlock outcome');
});

test('diagnostic logs retain the packaged release and fixed environment while rejecting malformed metadata', () => {
  const options = monitoringOptions({ development: false, mode: 'live' });
  const outbound = options.beforeSendLog!({ level: 'warn', message: 'Latch operation failed', attributes: {
    'sentry.release': 'com.mbeka02.latch@1.0.0+2', 'sentry.environment': 'private@example.com',
    'latch.stage': Object.assign(new String('transport'), { password: 'fixture-password' }) as never,
    'latch.error_code': 'fixture-token', 'http.response.status_code': 999,
    email: 'private@example.com', password: 'fixture-password',
  } });
  expect(outbound?.attributes).toEqual({ 'sentry.release': 'com.mbeka02.latch@1.0.0+2', 'sentry.environment': 'production-live' });
  const rejected = options.beforeSendLog!({ level: 'warn', message: 'Latch operation failed', attributes: {
    'sentry.release': 'fixture-token', 'latch.duration_ms': Infinity,
  } });
  expect(rejected?.attributes).toEqual({ 'sentry.environment': 'production-live' });
});

test('controlled operation errors and a unique verification marker remain identifiable', async () => {
  const options = monitoringOptions({ development: true, mode: 'demo' });
  for (const message of ['Latch unlock failed: unavailable', 'Latch Sentry verification 1794762000000']) {
    const outbound = await options.beforeSend!({ type: undefined, exception: { values: [{ type: 'Error', value: message }] } }, {});
    expect(outbound?.exception?.values?.[0].value).toBe(message);
  }
});

test('span export removes free-form data before the SDK serializes it', () => {
  const options = monitoringOptions({ development: false, mode: 'live' });
  const span = options.beforeSendSpan!({ trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), start_timestamp: 1,
    timestamp: 2, description: 'https://example.com/users/17?token=fixture-token', op: 'http.client',
    data: { password: 'fixture-password', 'http.url': 'https://example.com?totp=654321' } });
  expect(JSON.stringify(span)).not.toMatch(/fixture|654321|users\/17/);
});
