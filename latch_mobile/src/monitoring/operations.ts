import * as Sentry from '@sentry/react-native';
import { safeAccessError } from '@/lib/access-error';
import { entrySample, type MonitoredOperation } from '@/monitoring/policy';
import type { UnlockSnapshot } from '@/services/latch';
import type { Entry } from '@/lib/openpath';
import { isCoeEntryName } from '@/lib/entry-discovery';

function telemetry<T>(action: () => T): T | undefined {
  try { return action(); } catch { /* Monitoring must never decide a door operation's outcome. */ }
}

export function reportEntryDiscovery(entries: Entry[]) {
  telemetry(() => {
    const matches = entries.filter((entry) => isCoeEntryName(entry.name)).length;
    Sentry.logger.info('Latch entry discovery', {
      'latch.operation': 'entries', 'latch.result': !entries.length ? 'empty' : matches ? 'matched' : 'no-match',
      'latch.entry_count': entries.length, 'latch.coe_match_count': matches,
      'latch.entries_omitted': Math.max(0, entries.length - 20),
      'latch.entry_sample': entrySample(entries),
    });
  });
}

export function reportUnlockOutcome(status: UnlockSnapshot['status']) {
  if (!['accepted', 'denied', 'unknown', 'not-sent'].includes(status)) return;
  telemetry(() => Sentry.logger[status === 'accepted' ? 'info' : 'warn']('Latch unlock outcome', {
    'latch.operation': 'unlock', 'latch.result': status,
  }));
}

export type OperationDiagnostics = {
  stage?: 'transport' | 'timeout' | 'response-status' | 'response-validation';
  status?: number;
};

export async function observeOperation<T>(operation: MonitoredOperation, work: () => Promise<T>, diagnostics: OperationDiagnostics = {}): Promise<T> {
  const started = Date.now();
  const span = telemetry(() => Sentry.startInactiveSpan({ name: `latch.${operation}`, op: 'latch.operation', forceTransaction: true }));
  const attributes = () => ({ 'latch.operation': operation, 'latch.duration_ms': Math.max(0, Date.now() - started),
    ...(diagnostics.stage ? { 'latch.stage': diagnostics.stage } : {}),
    ...(diagnostics.status !== undefined ? { 'http.response.status_code': diagnostics.status } : {}) });
  try {
    const result = await work();
    telemetry(() => span?.setStatus({ code: 1 }));
    telemetry(() => Sentry.logger.info('Latch operation completed', { ...attributes(), 'latch.result': 'accepted' }));
    return result;
  }
  catch (error) {
    const failure = safeAccessError(error);
    telemetry(() => span?.setStatus({ code: 2, message: 'internal_error' }));
    if (['invalid-credentials', 'mfa-required', 'mfa-invalid', 'unsupported-auth', 'access-denied', 'expired'].includes(failure.code)) {
      telemetry(() => Sentry.logger.warn('Latch operation failed', { ...attributes(), 'latch.result': 'denied', 'latch.error_code': failure.code }));
      throw error;
    }
    telemetry(() => Sentry.logger.error('Latch operation failed', { ...attributes(), 'latch.result': 'failed', 'latch.error_code': failure.code }));
    telemetry(() => Sentry.captureException(new Error(`Latch ${operation} failed: ${failure.code}`)));
    throw error;
  } finally { telemetry(() => span?.end()); }
}
