import * as Sentry from '@sentry/react-native';
import { sendMonitoringVerification } from '@/monitoring/verification';

test('verification cannot claim an error is queued when monitoring is unavailable', async () => {
  jest.mocked(Sentry.getClient).mockReturnValueOnce(undefined);
  await expect(sendMonitoringVerification()).rejects.toThrow('Monitoring is not configured.');
});
