import { createLatch } from '@/services/latch';
import { createMockOpenpath } from '@/services/mocks/openpath';
import type { Entry, ProviderSession, UserContext } from '@/lib/openpath';
import { AccessError } from '@/lib/access-error';

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

test('a rejected replacement sign-in leaves no usable employee session', async () => {
  const { auth } = createLatch(createMockOpenpath());
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(auth.signIn({ email: 'demo@latch.example', password: 'wrong' })).rejects.toThrow();

  expect(auth.getSession()).toBeNull();
});

test('an MFA account requires a code without creating an authenticated session', async () => {
  const { auth } = createLatch(createMockOpenpath());

  await expect(auth.signIn({ email: 'mfa@latch.example', password: 'latch-demo-only' }))
    .rejects.toMatchObject({ code: 'mfa-required' });

  expect(auth.getSession()).toBeNull();
});

test('an MFA employee can recover from an invalid code using a valid demo code', async () => {
  const { auth } = createLatch(createMockOpenpath());
  const input = { email: 'mfa@latch.example', password: 'latch-demo-only' };
  await expect(auth.signIn({ ...input, totpCode: '000000' })).rejects.toMatchObject({ code: 'mfa-invalid' });
  expect(auth.getSession()).toBeNull();

  await auth.signIn({ ...input, totpCode: '123456' });

  expect(auth.getSession()?.email).toBe('mfa@latch.example');
});

test('SSO-only demo authentication is explicitly unsupported', async () => {
  const { auth } = createLatch(createMockOpenpath());
  await expect(auth.signIn({ email: 'sso@latch.example', password: 'latch-demo-only' }))
    .rejects.toMatchObject({ code: 'unsupported-auth' });
  expect(auth.getSession()).toBeNull();
});

test('provider failures give safe unavailable feedback without retaining an identity', async () => {
  const provider = { ...createMockOpenpath(), async login() { throw new Error('Sensitive provider response'); } };
  const { auth } = createLatch(provider);
  await expect(auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' }))
    .rejects.toMatchObject({ code: 'unavailable', message: 'The service is unavailable. Try again when your connection is restored.' });
  expect(auth.getSession()).toBeNull();
});

test('the local fifteen-minute cap expires the session and prevents a previously discovered unlock', async () => {
  let time = 1_800_000;
  const provider = createMockOpenpath();
  const { auth, doors } = createLatch(provider, { now: () => time });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const [door] = await doors.discoverDoors();
  time = 2_700_000;

  await expect(doors.requestUnlock(door.key)).rejects.toMatchObject({ code: 'expired' });
  expect(auth.getSession()).toBeNull();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('an earlier upstream expiry takes precedence over the local cap', async () => {
  let time = 1_800_000;
  const base = createMockOpenpath();
  const provider = { ...base, async login(input: Parameters<typeof base.login>[0]) {
    return { ...await base.login(input), expiresAt: 1_860_000 };
  } };
  const { auth } = createLatch(provider, { now: () => time });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  time = 1_860_000;

  expect(auth.getSession()).toBeNull();
});

test('restart restores a stored session through a current provider check without resetting its local cap', async () => {
  let time = 1_800_000;
  const storage = memoryStorage();
  const first = createLatch(createMockOpenpath(), { storage, now: () => time });
  await first.auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  time = 2_640_000;
  const restarted = createLatch(createMockOpenpath(), { storage, now: () => time });

  await restarted.auth.restore();

  expect(restarted.auth.getSession()?.email).toBe('demo@latch.example');
  time = 2_700_000;
  expect(restarted.auth.getSession()).toBeNull();
});

test('a secure-storage write failure leaves authentication unusable with safe recovery feedback', async () => {
  const storage = { ...memoryStorage(), async write() { throw new Error('Native storage details'); } };
  const { auth } = createLatch(createMockOpenpath(), { storage });
  await expect(auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' }))
    .rejects.toMatchObject({ code: 'storage' });
  expect(auth.getSession()).toBeNull();
});

test('a failed secure-store read prevents restoration and exposes safe recovery feedback', async () => {
  const storage = { ...memoryStorage(), async read(): Promise<string | null> { throw new Error('Native key details'); } };
  const { auth } = createLatch(createMockOpenpath(), { storage });
  await expect(auth.restore()).rejects.toMatchObject({ code: 'storage' });
  expect(auth.getSession()).toBeNull();
});

test('local sign-out removes the saved session so a restart cannot restore it', async () => {
  const storage = memoryStorage();
  const first = createLatch(createMockOpenpath(), { storage });
  await first.auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await first.auth.signOut();
  const restarted = createLatch(createMockOpenpath(), { storage });

  expect(await restarted.auth.restore()).toBeNull();
});

test('an incomplete stored record is discarded without attempting a session grant', async () => {
  const storage = memoryStorage();
  await storage.write('{"version":1}');
  const { auth } = createLatch(createMockOpenpath(), { storage });

  await expect(auth.restore()).rejects.toMatchObject({ code: 'storage' });
  expect(auth.getSession()).toBeNull();
  expect(await storage.read()).toBeNull();
});

test('restoration rejects a different identity returned for the stored token', async () => {
  const storage = memoryStorage();
  const base = createMockOpenpath();
  await createLatch(base, { storage }).auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const provider = { ...base, async checkSession(token: string) {
    const result = await base.checkSession(token);
    return { ...result, user: { ...result.user, identityId: 'a-different-employee' } };
  } };
  const { auth } = createLatch(provider, { storage });

  await expect(auth.restore()).rejects.toMatchObject({ code: 'expired' });
  expect(auth.getSession()).toBeNull();
  expect(await storage.read()).toBeNull();
});

test('a restoration outage blocks access but permits a later deliberate session check', async () => {
  const storage = memoryStorage();
  const base = createMockOpenpath();
  await createLatch(base, { storage }).auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  let offline = true;
  const provider = { ...base, async checkSession(token: string) {
    if (offline) throw new Error('Raw network response');
    return base.checkSession(token);
  } };
  const { auth, doors } = createLatch(provider, { storage });

  await expect(auth.restore()).rejects.toMatchObject({ code: 'unavailable' });
  expect(auth.getSession()).toBeNull();
  await expect(doors.discoverDoors()).rejects.toThrow();
  offline = false;
  await auth.restore();
  expect(auth.getSession()?.email).toBe('demo@latch.example');
});

test('a late sign-in response cannot authenticate after local sign-out', async () => {
  const base = createMockOpenpath();
  const response = deferred<ProviderSession>();
  const started = deferred<void>();
  const provider = { ...base, async login() { started.resolve(); return response.promise; } };
  const { auth } = createLatch(provider);
  const pending = auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' }).catch((error) => error);
  await started.promise;
  await auth.signOut();
  response.resolve(await base.login({ email: 'demo@latch.example', password: 'latch-demo-only' }));

  expect(await pending).toMatchObject({ code: 'stale-operation' });
  expect(auth.getSession()).toBeNull();
});

test('sign-out stays durable when an earlier native session write finishes late', async () => {
  const backing = memoryStorage();
  const started = deferred<void>();
  const release = deferred<void>();
  const storage = { ...backing, async write(value: string) {
    started.resolve();
    await release.promise;
    await backing.write(value);
  } };
  const { auth } = createLatch(createMockOpenpath(), { storage });
  const pending = auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' }).catch((error) => error);
  await started.promise;
  const logout = auth.signOut();
  expect(auth.getSession()).toBeNull();
  release.resolve();
  await logout;
  expect(await pending).toMatchObject({ code: 'stale-operation' });

  expect(await createLatch(createMockOpenpath(), { storage }).auth.restore()).toBeNull();
});

test('a late restoration check cannot replace a newly signed-in account', async () => {
  const storage = memoryStorage();
  const base = createMockOpenpath();
  await createLatch(base, { storage }).auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const response = deferred<ProviderSession>();
  const started = deferred<void>();
  const provider = { ...base, async checkSession() { started.resolve(); return response.promise; } };
  const { auth } = createLatch(provider, { storage });
  const pending = auth.restore().catch((error) => error);
  await started.promise;
  expect(auth.getSession()).toBeNull();
  await auth.signIn({ email: 'mfa@latch.example', password: 'latch-demo-only', totpCode: '123456' });
  response.resolve(await base.checkSession('simulated-session:demo@latch.example'));

  expect(await pending).toMatchObject({ code: 'stale-operation' });
  expect(auth.getSession()?.email).toBe('mfa@latch.example');
});

test('late door discovery from the previous account cannot replace the current account selection', async () => {
  const base = createMockOpenpath();
  const response = deferred<Entry[]>();
  const started = deferred<void>();
  const provider = { ...base, async listUserEntries(context: UserContext) {
    if (context.token === 'simulated-session:demo@latch.example') { started.resolve(); return response.promise; }
    return base.listUserEntries(context);
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const previous = doors.discoverDoors().catch((error) => error);
  await started.promise;
  await auth.signIn({ email: 'mfa@latch.example', password: 'latch-demo-only', totpCode: '123456' });
  const [current] = await doors.discoverDoors();
  response.resolve([{ id: 303, name: 'COE Door', site: 'Old site', zone: 'Old zone' }]);

  expect(await previous).toMatchObject({ code: 'stale-operation' });
  expect(await doors.requestUnlock(current.key)).toMatchObject({ status: 'accepted' });
  expect(base.getUnlockRequests()).toEqual([
    { orgId: 101, userId: 203, entryId: 303, credentialId: 505 },
  ]);
});

test('expired saved sessions are removed instead of being renewed on restart', async () => {
  let time = 1_800_000;
  const storage = memoryStorage();
  await createLatch(createMockOpenpath(), { storage, now: () => time }).auth.signIn({
    email: 'demo@latch.example', password: 'latch-demo-only',
  });
  time = 2_700_000;
  const { auth } = createLatch(createMockOpenpath(), { storage, now: () => time });

  await expect(auth.restore()).rejects.toMatchObject({ code: 'expired' });
  expect(auth.getSession()).toBeNull();
  expect(await storage.read()).toBeNull();
});

test('definitive token rejection during discovery clears both the active and saved session', async () => {
  const storage = memoryStorage();
  const provider = { ...createMockOpenpath(), async listUserEntries(): Promise<Entry[]> { throw new AccessError('expired'); } };
  const { auth, doors } = createLatch(provider, { storage });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'expired' });

  expect(auth.getSession()).toBeNull();
  expect(await storage.read()).toBeNull();
});

test('retrying after a failed logout deletion clears storage instead of restoring the old account', async () => {
  const backing = memoryStorage();
  let failing = false;
  const storage = { ...backing, async clear() {
    if (failing) throw new Error('Native deletion failed');
    await backing.clear();
  } };
  const { auth } = createLatch(createMockOpenpath(), { storage });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  failing = true;
  await expect(auth.signOut()).rejects.toMatchObject({ code: 'storage' });
  expect(auth.getSession()).toBeNull();
  failing = false;

  expect(await auth.restore()).toBeNull();
  expect(await storage.read()).toBeNull();
});

test('a malformed upstream expiry cannot create an indefinitely usable session', async () => {
  const base = createMockOpenpath();
  const provider = { ...base, async login(input: Parameters<typeof base.login>[0]) {
    return { ...await base.login(input), expiresAt: Number.NaN };
  } };
  const { auth } = createLatch(provider);

  await expect(auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' }))
    .rejects.toMatchObject({ code: 'unavailable' });
  expect(auth.getSession()).toBeNull();
});

test('a failed native deletion does not resurrect the signed-out token in a fresh app instance', async () => {
  const backing = memoryStorage();
  let failing = false;
  const storage = { ...backing, async clear() {
    if (failing) throw new Error('Deletion unavailable');
    await backing.clear();
  } };
  const first = createLatch(createMockOpenpath(), { storage });
  await first.auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  failing = true;
  await expect(first.auth.signOut()).rejects.toMatchObject({ code: 'storage' });
  const restarted = createLatch(createMockOpenpath(), { storage });

  await expect(restarted.auth.restore()).rejects.toMatchObject({ code: 'storage' });
  expect(restarted.auth.getSession()).toBeNull();
});

test('an explicit unlock uses the discovered entry and the employee\'s existing Cloud Key', async () => {
  const provider = createMockOpenpath({
    entries: [{ id: 9876, name: 'COE Door', site: 'Assessment site', zone: 'Engineering' }],
    credentials: [{ id: 8765, kind: 'cloud-key', validFrom: null, validUntil: null }],
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
    credentials: [{ id: 8765, kind: 'cloud-key', validFrom: null, validUntil: null }],
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

test('an unrelated entry never becomes a COE choice or an unlock target', async () => {
  const provider = createMockOpenpath({ entries: [{ id: 999, name: 'Reception', site: 'Demo', zone: 'Lobby' }] });
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'entry-not-found' });
  await expect(doors.requestUnlock('choice-1')).rejects.toThrow();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('an employee chooses their organisation instead of silently using the first membership', async () => {
  const base = createMockOpenpath();
  const provider = { ...base, async login(input: Parameters<typeof base.login>[0]) {
    return { ...await base.login(input), memberships: [
      { orgId: 101, userId: 202, organisation: 'IFSS demo' },
      { orgId: 606, userId: 707, organisation: 'Engineering demo' },
    ] };
  }, async listUserEntries(context: UserContext) {
    return [{ id: 808, name: 'COE Door', site: context.membership.organisation, zone: 'Lab' }];
  }, async listCredentials() { return { items: [{ id: 909, kind: 'cloud-key' as const, validFrom: null, validUntil: null }], nextOffset: null }; },
  async unlockEntry(command: Parameters<typeof base.unlockEntry>[0]) {
    expect(command.context.membership).toEqual({ orgId: 606, userId: 707, organisation: 'Engineering demo' });
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'organisation-required' });
  const organisations = doors.discoverOrganisations();
  expect(organisations.map(({ name }) => name)).toEqual(['IFSS demo', 'Engineering demo']);
  const [door] = await doors.discoverDoors(organisations[1].key);
  expect(door.organisation).toBe('Engineering demo');
  expect(await doors.requestUnlock(door.key)).toMatchObject({ status: 'accepted' });
});

test('distinct COE matches require an explicit choice with their original site and zone context', async () => {
  const provider = createMockOpenpath({ entries: [
    { id: 11, name: ' coe DOOR ', site: 'North building', zone: 'Lab' },
    { id: 12, name: 'COE Door', site: 'South building', zone: 'Lab' },
    { id: 13, name: 'COE Door annex', site: 'East building', zone: 'Lab' },
  ] });
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  const choices = await doors.discoverDoors();
  expect(choices.map(({ name, site, zone }) => ({ name, site, zone }))).toEqual([
    { name: ' coe DOOR ', site: 'North building', zone: 'Lab' },
    { name: 'COE Door', site: 'South building', zone: 'Lab' },
  ]);
  expect(provider.getUnlockRequests()).toEqual([]);
  await doors.requestUnlock(choices[1].key);
  expect(provider.getUnlockRequests()).toEqual([{ orgId: 101, userId: 202, entryId: 12, credentialId: 404 }]);
});

test.each([
  [{ id: 11, name: 'COE Door', site: 'Building', zone: 'Lab' }, { id: 12, name: 'COE Door', site: ' building ', zone: 'LAB' }],
  [{ id: 11, name: 'COE Door', site: '', zone: '' }, { id: 12, name: 'COE Door', site: '', zone: '' }],
])('indistinguishable COE entries cannot become ready choices: %j', async (...entries) => {
  const provider = createMockOpenpath({ entries });
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'ambiguous-entry' });
  await expect(doors.requestUnlock('choice-1')).rejects.toThrow();
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('an expired Cloud Key cannot enable discovery', async () => {
  const provider = createMockOpenpath({ credentials: [{ id: 404, kind: 'cloud-key', validFrom: null, validUntil: 1_800_000 }] });
  const { auth, doors } = createLatch(provider, { now: () => 1_800_000 });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'credential-unavailable' });
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('discovery reads the later credential page before deciding which Cloud Key is usable', async () => {
  const base = createMockOpenpath();
  const provider = { ...base, async listCredentials(_context: UserContext, offset = 0) {
    return offset === 0
      ? { items: [{ id: 404, kind: 'cloud-key' as const, validFrom: null, validUntil: 1_800_000 }], nextOffset: 1 }
      : { items: [{ id: 505, kind: 'cloud-key' as const, validFrom: null, validUntil: null }], nextOffset: null };
  }, async unlockEntry(command: Parameters<typeof base.unlockEntry>[0]) {
    expect(command.credentialId).toBe(505);
  } };
  const { auth, doors } = createLatch(provider, { now: () => 1_800_000 });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  const [door] = await doors.discoverDoors();
  expect(await doors.requestUnlock(door.key)).toMatchObject({ status: 'accepted' });
});

test('an entry removed after discovery cannot dispatch an unlock from its earlier choice', async () => {
  const base = createMockOpenpath();
  let removed = false;
  const provider = { ...base, async listUserEntries(context: UserContext) {
    return removed ? [] : base.listUserEntries(context);
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const [door] = await doors.discoverDoors();
  removed = true;

  await expect(doors.requestUnlock(door.key)).rejects.toMatchObject({ code: 'access-changed' });
  expect(base.getUnlockRequests()).toEqual([]);
});

test('an older discovery cannot publish choices after a newer organisation discovery', async () => {
  const base = createMockOpenpath();
  const response = deferred<Entry[]>();
  const started = deferred<void>();
  let slow = true;
  const provider = { ...base, async listUserEntries(context: UserContext) {
    if (slow) { slow = false; started.resolve(); return response.promise; }
    return base.listUserEntries(context);
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const old = doors.discoverDoors().catch((error) => error);
  await started.promise;
  const [current] = await doors.discoverDoors();
  response.resolve([{ id: 999, name: 'COE Door', site: 'Obsolete building', zone: 'COE' }]);

  expect(await old).toMatchObject({ code: 'access-changed' });
  expect(await doors.requestUnlock(current.key)).toMatchObject({ status: 'accepted' });
});

test.each([
  [],
  [{ id: 10, kind: 'mobile' as const, validFrom: null, validUntil: null }],
  [{ id: 10, kind: 'cloud-key' as const, validFrom: 1_800_001, validUntil: null }],
  [{ id: 10, kind: 'cloud-key' as const, validFrom: null, validUntil: Number.NaN }],
  [{ id: 10, kind: 'cloud-key' as const, validFrom: null, validUntil: null },
    { id: 11, kind: 'cloud-key' as const, validFrom: null, validUntil: null }],
])('missing, inactive or ambiguous Cloud Keys never enable a door: %j', async (...credentials) => {
  const provider = createMockOpenpath({ credentials });
  const { auth, doors } = createLatch(provider, { now: () => 1_800_000 });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'credential-unavailable' });
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('a denied credential page prevents partial discovery from granting access', async () => {
  const base = createMockOpenpath();
  const provider = { ...base, async listCredentials(_context: UserContext, offset: number) {
    if (offset > 0) throw new AccessError('access-denied');
    return { items: [{ id: 404, kind: 'cloud-key' as const, validFrom: null, validUntil: null }], nextOffset: 1 };
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'access-denied' });
  expect(base.getUnlockRequests()).toEqual([]);
});

test('reopening organisation selection invalidates the previous door choice', async () => {
  const provider = createMockOpenpath();
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const [door] = await doors.discoverDoors();
  doors.discoverOrganisations();
  await expect(doors.requestUnlock(door.key)).rejects.toMatchObject({ code: 'access-changed' });
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('organisation associations with indistinguishable names require IFSS clarification', async () => {
  const base = createMockOpenpath();
  const provider = { ...base, async login(input: Parameters<typeof base.login>[0]) {
    return { ...await base.login(input), memberships: [
      { orgId: 101, userId: 202, organisation: 'IFSS demo' },
      { orgId: 606, userId: 707, organisation: ' ifss DEMO ' },
    ] };
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  expect(() => doors.discoverOrganisations()).toThrow('Organisation names are missing or ambiguous. Ask IFSS to clarify your memberships.');
  await expect(doors.discoverDoors('org-1-1')).rejects.toMatchObject({ code: 'organisation-unavailable' });
});

test.each([
  ['missing@latch.example', 'entry-not-found'],
  ['ambiguous@latch.example', 'ambiguous-entry'],
  ['denied@latch.example', 'access-denied'],
])('the %s demo authenticates but cannot grant unavailable door access', async (email, code) => {
  const provider = createMockOpenpath();
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email, password: 'latch-demo-only' });

  await expect(doors.discoverDoors()).rejects.toMatchObject({ code });
  expect(auth.getSession()?.email).toBe(email);
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('a Cloud Key that expires after discovery is not dispatched or silently replaced', async () => {
  let time = 1_800_000;
  const provider = createMockOpenpath({ credentials: [
    { id: 404, kind: 'cloud-key', validFrom: null, validUntil: 1_800_100 },
    { id: 505, kind: 'cloud-key', validFrom: 1_800_100, validUntil: null },
  ] });
  const { auth, doors } = createLatch(provider, { now: () => time });
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  const [door] = await doors.discoverDoors();
  time = 1_800_100;

  await expect(doors.requestUnlock(door.key)).rejects.toMatchObject({ code: 'access-changed' });
  expect(provider.getUnlockRequests()).toEqual([]);
  const [refreshed] = await doors.discoverDoors();
  await doors.requestUnlock(refreshed.key);
  expect(provider.getUnlockRequests()).toEqual([{ orgId: 101, userId: 202, entryId: 303, credentialId: 505 }]);
});

test('a valid key on the first page does not hide an ambiguous key on a later page', async () => {
  const provider = createMockOpenpath({ credentials: [
    { id: 404, kind: 'cloud-key', validFrom: null, validUntil: null },
    { id: 500, kind: 'mobile', validFrom: null, validUntil: null },
    { id: 505, kind: 'cloud-key', validFrom: null, validUntil: null },
  ] });
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'credential-unavailable' });
  expect(provider.getUnlockRequests()).toEqual([]);
});

test('non-advancing credential pagination fails safely instead of enabling partial access', async () => {
  const base = createMockOpenpath();
  const provider = { ...base, async listCredentials() {
    return { items: [{ id: 404, kind: 'cloud-key' as const, validFrom: null, validUntil: null }], nextOffset: 0 };
  } };
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });
  await expect(doors.discoverDoors()).rejects.toMatchObject({ code: 'unavailable' });
  expect(base.getUnlockRequests()).toEqual([]);
});

test('organisation and door references from a previous account cannot be reused', async () => {
  const provider = createMockOpenpath();
  const { auth, doors } = createLatch(provider);
  await auth.signIn({ email: 'multi@latch.example', password: 'latch-demo-only' });
  const [, organisation] = doors.discoverOrganisations();
  const [door] = await doors.discoverDoors(organisation.key);
  await auth.signIn({ email: 'demo@latch.example', password: 'latch-demo-only' });

  await expect(doors.discoverDoors(organisation.key)).rejects.toMatchObject({ code: 'organisation-required' });
  await expect(doors.requestUnlock(door.key)).rejects.toMatchObject({ code: 'access-changed' });
  expect(provider.getUnlockRequests()).toEqual([]);
});

function memoryStorage() {
  let value: string | null = null;
  return {
    async read() { return value; },
    async write(next: string) { value = next; },
    async clear() { value = null; },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
