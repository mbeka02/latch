import * as Sentry from '@sentry/react-native';
import { safeAccessError } from '@/lib/access-error';
import type { MonitoredOperation } from '@/monitoring/policy';
import type { UnlockSnapshot } from '@/services/latch';

function telemetry<T>(action: () => T): T | undefined {
  try { return action(); } catch { /* Monitoring must never decide a door operation's outcome. */ }
}

export function reportUnlockOutcome(status: UnlockSnapshot['status']) {
  if (!['accepted', 'denied', 'unknown', 'not-sent'].includes(status)) return;
  telemetry(() => Sentry.logger[status === 'accepted' ? 'info' : 'warn']('Latch unlock outcome', {
    'latch.operation': 'unlock', 'latch.result': status,
  }));
}

export async function observeOperation<T>(operation: MonitoredOperation, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const span = telemetry(() => Sentry.startInactiveSpan({ name: `latch.${operation}`, op: 'latch.operation', forceTransaction: true }));
  try {
    const result = await work();
    telemetry(() => span?.setStatus({ code: 1 }));
    telemetry(() => Sentry.logger.info('Latch operation completed', { 'latch.operation': operation, 'latch.result': 'accepted',
      'latch.duration_ms': Math.max(0, Date.now() - started) }));
    return result;
  }
  catch (error) {
    const failure = safeAccessError(error);
    telemetry(() => span?.setStatus({ code: 2, message: 'internal_error' }));
    if (['invalid-credentials', 'mfa-required', 'mfa-invalid', 'unsupported-auth', 'access-denied', 'expired'].includes(failure.code)) {
      telemetry(() => Sentry.logger.warn('Latch operation failed', { 'latch.operation': operation, 'latch.result': 'denied' }));
      throw error;
    }
    telemetry(() => Sentry.logger.error('Latch operation failed', { 'latch.operation': operation, 'latch.result': 'failed' }));
    telemetry(() => Sentry.captureException(new Error(`Latch ${operation} failed: ${failure.code}`)));
    throw error;
  } finally { telemetry(() => span?.end()); }
}
