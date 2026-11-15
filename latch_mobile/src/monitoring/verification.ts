import * as Sentry from '@sentry/react-native';
import { observeOperation } from '@/monitoring/operations';

// Called only by the opt-in development/demo control through the normal app init.
export async function sendMonitoringVerification(): Promise<string> {
  const client = Sentry.getClient();
  if (!client || client.getOptions().enabled === false) throw new Error('Monitoring is not configured.');
  const message = `Latch Sentry verification ${Date.now()}`;
  await observeOperation('session-check', async () => {
    try { throw new Error(message); }
    catch (error) { Sentry.captureException(error); }
    if (!await Sentry.flush()) throw new Error('Monitoring flush did not complete.');
  });
  return message;
}
