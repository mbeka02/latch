import { createAndroidTransport, type NativeOpenpathClient } from '@/services/openpath-transport';

test('aborting a native request cancels its handle and ignores a late success', async () => {
  let complete!: (result: { status: number; body: string }) => void;
  const handles: string[] = [];
  const cancelled: string[] = [];
  const native: NativeOpenpathClient = {
    request: async (handle) => { handles.push(handle); return new Promise((resolve) => { complete = resolve; }); },
    cancel: (handle) => { cancelled.push(handle); },
  };
  const controller = new AbortController();
  const pending = createAndroidTransport(native)({ method: 'POST', path: '/auth/login', body: { email: 'fixture', password: 'private' } }, controller.signal);
  controller.abort();
  complete({ status: 201, body: '{}' });
  await expect(pending).rejects.toMatchObject({ code: 'unavailable' });
  expect(cancelled).toEqual(handles);
  expect(handles).toHaveLength(1);
});

test('a missing native module fails closed instead of using fetch or a demo provider', async () => {
  await expect(createAndroidTransport(null)({ method: 'POST', path: '/auth/login', body: { email: 'fixture', password: 'private' } }, new AbortController().signal))
    .rejects.toMatchObject({ code: 'unavailable' });
});
