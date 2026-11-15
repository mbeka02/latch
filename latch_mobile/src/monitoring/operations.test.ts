import * as Sentry from '@sentry/react-native';
import { observeOperation } from '@/monitoring/operations';
import { AccessError } from '@/lib/access-error';

afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

test('a failed operation reports a safe classification once and propagates the original failure', async () => {
  const error = new Error('fixture-password fixture-token private@example.com');
  const work = jest.fn(async () => { throw error; });
  await expect(observeOperation('login', work)).rejects.toBe(error);
  expect(work).toHaveBeenCalledTimes(1);
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  expect(jest.mocked(Sentry.captureException).mock.calls[0][0]).toMatchObject({ message: 'Latch login failed: unavailable' });
  expect(JSON.stringify(jest.mocked(Sentry.logger.error).mock.calls)).not.toMatch(/fixture|private@example/);
});

test('successful operations record timing without logging input or return data', async () => {
  const result = { token: 'fixture-token', email: 'private@example.com' };
  const work = jest.fn(async () => result);
  await expect(observeOperation('unlock', work)).resolves.toBe(result);
  expect(work).toHaveBeenCalledTimes(1);
  expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({ name: 'latch.unlock', op: 'latch.operation', forceTransaction: true });
  expect(Sentry.logger.info).toHaveBeenCalledWith('Latch operation completed', expect.objectContaining({ 'latch.operation': 'unlock', 'latch.result': 'accepted' }));
  expect(JSON.stringify(jest.mocked(Sentry.logger.info).mock.calls)).not.toMatch(/fixture|private@example/);
});

test('monitoring failures cannot block, change or repeat an unlock operation', async () => {
  jest.spyOn(Sentry, 'startInactiveSpan').mockImplementationOnce(() => { throw new Error('Telemetry unavailable'); });
  jest.spyOn(Sentry.logger, 'info').mockImplementation(() => { throw new Error('Telemetry unavailable'); });
  const work = jest.fn(async () => 'accepted');
  await expect(observeOperation('unlock', work)).resolves.toBe('accepted');
  expect(work).toHaveBeenCalledTimes(1);
});

test('expected authorization rejection is observable without creating a crash issue', async () => {
  await expect(observeOperation('unlock', async () => { throw new AccessError('access-denied'); }))
    .rejects.toMatchObject({ code: 'access-denied' });
  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(Sentry.logger.warn).toHaveBeenCalledWith('Latch operation failed', expect.objectContaining({ 'latch.operation': 'unlock', 'latch.result': 'denied' }));
});
