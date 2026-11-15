import { createLatch } from '@/services/latch';
import { createMockOpenpath } from '@/services/mocks/openpath';

test('a demo employee can sign in and read their identity without exposing the provider token', async () => {
  const { auth } = createLatch(createMockOpenpath());

  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  expect(auth.getSession()).toEqual({
    identityId: 'demo-employee',
    name: 'Demo employee',
    email: 'demo@latch.example',
  });
});

test('signing out clears the employee session', async () => {
  const { auth } = createLatch(createMockOpenpath());
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  auth.signOut();

  expect(auth.getSession()).toBeNull();
});

test('an explicit unlock uses the discovered entry and the employee\'s existing Cloud Key', async () => {
  const provider = createMockOpenpath({
    entries: [{ id: 9876, name: 'COE Door', site: 'Assessment site', zone: 'Engineering' }],
    credentials: [{ id: 8765, kind: 'cloud-key' }],
  });
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const [door] = await doors.discoverDoors();

  expect(await doors.requestUnlock(door.key)).toEqual({ status: 'accepted', simulated: true });
  expect(provider.getUnlockRequests()).toEqual([
    { orgId: 101, userId: 202, entryId: 9876, credentialId: 8765 },
  ]);
});

test('the employee discovers COE from their provider data and existing Cloud Key', async () => {
  const { auth, doors } = createLatch(createMockOpenpath({
    entries: [{ id: 9876, name: 'COE Door', site: 'Assessment site', zone: 'Engineering' }],
    credentials: [{ id: 8765, kind: 'cloud-key' }],
  }));
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  expect(await doors.discoverDoors()).toEqual([{
    key: expect.any(String),
    name: 'COE Door',
    organisation: 'IFSS demo',
    site: 'Assessment site',
    zone: 'Engineering',
  }]);
});
