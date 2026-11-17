import { AccessError } from '@/lib/access-error';
import type { Openpath, SessionHints, UserSession, Membership, UserContext, Credential } from '@/lib/openpath';
import { observeOperation, reportEntryDiscovery, type OperationDiagnostics } from '@/monitoring/operations';

function bad(): never { throw new AccessError('unavailable'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad();
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : bad(); }
function id(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : bad(); }
function text(value: unknown): string { return typeof value === 'string' && value.trim() ? value.trim() : bad(); }
function date(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)) return bad();
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : bad();
}
function data(body: string): Record<string, unknown> {
  try { return object(object(JSON.parse(body)).data); } catch { return bad(); }
}
function userPath(context: UserContext) {
  text(context.token);
  return `/orgs/${id(context.membership.orgId)}/users/${id(context.membership.userId)}`;
}

// The transport owns the fixed HTTPS origin, raw Authorization header, redirect
// rejection, cancellation and the one-exchange budget. It must never retry.
export type OpenpathRequest = {
  method: 'GET' | 'POST'; path: string; token?: string; body?: Record<string, unknown>;
};
export type OpenpathTransport = (request: OpenpathRequest, signal: AbortSignal) => Promise<{ status: number; body: string }>;

export function createOpenpath(transport: OpenpathTransport, options: { namespaceNickname?: string } = {}): Openpath {
  async function send<T>(request: OpenpathRequest, expected: number, decode: (body: string) => T) {
    const operation = request.path === '/auth/login' ? 'login' : request.path.endsWith('/cloudKeyEntryUnlock') ? 'unlock'
      : request.path.endsWith('/entries') ? 'entries' : request.path.includes('/credentials?') ? 'credentials' : 'session-check';
    const diagnostics: OperationDiagnostics = { stage: 'transport' };
    return observeOperation(operation, async () => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { diagnostics.stage = 'timeout'; controller.abort(); reject(new AccessError('unavailable')); }, 15_000);
      });
      let response;
      try { response = await Promise.race([transport(request, controller.signal), deadline]); }
      catch { return bad(); }
      finally { clearTimeout(timer!); }
      diagnostics.stage = 'response-status';
      diagnostics.status = response.status;
      if (response.status !== expected) {
        // Status policies, not vendor error-code contracts. Never expose the body.
        if (request.path === '/auth/login' && [400, 401, 403].includes(response.status)) throw new AccessError('invalid-credentials');
        if (response.status === 401) throw new AccessError('expired');
        if (response.status === 403) throw new AccessError('access-denied');
        return bad();
      }
      diagnostics.stage = 'response-validation';
      try { return decode(response.body); }
      catch (error) {
        if (error instanceof AccessError && error.code !== 'unavailable') throw error;
        throw new AccessError('invalid-response');
      }
    }, diagnostics);
  }
  async function profileSession(token: string, hints: SessionHints) {
    text(token);
    if (!hints.associations.length || hints.associations.length > 100) return bad();
    const memberships: Membership[] = [];
    let user: UserSession | undefined;
    const seen = new Set<string>();
    for (const hint of hints.associations) {
      const orgId = id(hint.orgId), userId = id(hint.userId);
      const key = `${orgId}/${userId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await send({ method: 'GET', path: `/orgs/${orgId}/users/${userId}`, token }, 200, (body) => {
        const value = data(body), identity = object(value.identity);
        if (id(value.id) !== userId || String(id(identity.id)) !== hints.identityId) throw new AccessError('expired');
        const email = text(identity.email);
        if (user && user.email !== email) return bad();
        user = { identityId: hints.identityId, email, name: text(identity.fullName ?? email) };
        let org: Record<string, unknown>;
        if (identity.users === undefined) {
          // The observed EU own-user response omits this optional expansion.
          // Namespace context is usable only for the exact login-derived org;
          // it must never stand in for another organisation membership.
          org = object(object(identity.namespace).org);
          if (id(org.id) !== orgId) return bad();
        } else {
          // A present but malformed/contradictory expansion cannot be bypassed.
          const associations = array(identity.users).map(object).filter((item) =>
            item.id === userId && object(item.org).id === orgId);
          if (associations.length !== 1) return bad();
          org = object(associations[0].org);
        }
        memberships.push({ orgId, userId, organisation: text(org.name) });
      });
    }
    if (!user) return bad();
    return { token, expiresAt: null, user, memberships };
  }
  return {
    environment: 'live',
    async login(input) {
      const parsed = await send({ method: 'POST', path: '/auth/login', body: { email: input.email, password: input.password,
        ...(options.namespaceNickname ? { namespaceNickname: options.namespaceNickname } : {}),
        ...(input.totpCode ? { mfa: { totpCode: input.totpCode } } : {}) } }, 201, (body) => {
        const value = data(body);
        const token = text(value.token);
        const identityId = id(value.identityId);
        if (id(object(value.identity).id) !== identityId) return bad();
        const expiresAt = date(value.expiresAt);
        const memberships = array(value.tokenScopeList).flatMap((item) => {
          const row = object(item);
          if (row.org == null || row.user == null) return [];
          const org = object(row.org), user = object(row.user);
          if (org.id === null || user.id === null) return [];
          return [{ orgId: id(org.id), userId: id(user.id) }];
        });
        if (!memberships.length) return bad();
        return { token, identityId, expiresAt, memberships };
      });
      const { token, identityId, expiresAt, memberships } = parsed;
      return { ...await profileSession(token, { identityId: String(identityId), associations: memberships }), expiresAt };
    },
    async checkSession(token, hints) {
      if (!hints || typeof hints.identityId !== 'string' || !Array.isArray(hints.associations)) throw new AccessError('expired');
      return profileSession(token, hints);
    },
    async listUserEntries(context) {
      return send({ method: 'GET', path: `${userPath(context)}/entries`, token: context.token }, 200, (body) => {
        try {
          const value = object(JSON.parse(body));
          const values = array(value.data);
          const count = value.filteredCount ?? value.totalCount;
          // This endpoint declares no pagination parameters. Never guess them or
          // choose a door from a response that may omit another COE match.
          if (!Number.isSafeInteger(count) || count !== values.length) return bad();
          const result = values.map((item) => {
            const entry = object(item), zone = object(entry.zone), site = object(zone.site);
            return { id: id(entry.id), name: text(entry.name), zone: text(zone.name), site: text(site.name) };
          });
          if (new Set(result.map((entry) => entry.id)).size !== result.length) return bad();
          reportEntryDiscovery(result);
          return result;
        } catch { return bad(); }
      });
    },
    async listCredentials(context, offset) {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10_000) return bad();
      return send({ method: 'GET', path: `${userPath(context)}/credentials?limit=100&offset=${offset}&sort=id&order=asc`, token: context.token }, 200, (body) => {
        try {
          const page = object(JSON.parse(body));
          const values = array(page.data);
          const count = page.filteredCount ?? page.totalCount;
          if (count !== undefined && (!Number.isSafeInteger(count) || (count as number) < offset + values.length ||
              (!values.length && count !== offset))) return bad();
          const items = values.map((item): Credential => {
            const value = object(item);
            const variants = ['mobile', 'card', 'pincode', 'cardMifareCsn', 'cardOpenpathDesfireEv1', 'cloudKey',
              'fobAllegion', 'allegionMobile', 'licensePlate', 'wallet'].filter((key) => value[key] != null);
            if (variants.length !== 1) return bad();
            if (variants[0] !== 'licensePlate') id(object(value[variants[0]]).id);
            return { id: id(value.id), kind: variants[0] === 'cloudKey' ? 'cloud-key' : variants[0] === 'mobile' ? 'mobile' : 'other',
              validFrom: date(value.startDate), validUntil: date(value.endDate) };
          });
          return { items, nextOffset: items.length ? offset + items.length : null };
        } catch { return bad(); }
      });
    },
    async unlockEntry(command) {
      await send({ method: 'POST', path: `${userPath(command.context)}/credentials/${id(command.credentialId)}/cloudKeyEntryUnlock`,
        token: command.context.token, body: { entryId: id(command.entryId) } }, 204, () => undefined);
    },
  };
}
