# Phase 5 Openpath contract evidence

Checked **2026-11-15** against official public Openpath ReadMe pages and the OpenAPI JSON embedded in each page's `script#ssr-props` → `document.api.schema`. No tenant API calls, credentials, tokens, account changes or unlocks were involved. The reference's advertised server is `https://api.openpath.com`; JWT security is an API key in the `Authorization` header, with the raw token and no `Bearer` prefix. [Authentication guide](https://openpath.readme.io/docs/using-the-api), [entry schema](https://openpath.readme.io/reference/listuserentries)

The assessment targets the intended evaluator's supported native account. General portal-disabled employee eligibility is outside this phase's gate. Tenant authorization and Android transport behavior still require their own evidence; schema checks establish neither.

## Regional host investigation — 2026-11-16

The user's portal returns to `https://access.eu.alta.avigilon.com/signin?hasPortalAccess=false`. The route flag expresses the portal's access decision, not an HTTP status or proof of the exact password-login result. A browser application can make a successful HTTP request and then navigate to this route based on response data; a red Network row is not required for a portal denial.

The [Avigilon Alta Access Administrator Guide](https://www.avigilon.com/fs/documents/avigilon-alta-access-administrator-guide-en.pdf), printed page 131 (PDF page index 130), explicitly lists `https://api.openpath.com` for US users and `https://api.eu.openpath.com` for EU users as region base URLs. Current [SCIM integration documentation](https://docs.avigilon.com/bundle/alta-access-identity-management-integrations/page/integrations/okta/okta-scim-sync.htm) also distinguishes these two regional API hosts. These sources establish the documented EU host; they do not by themselves verify this user's `/auth/login` eligibility or response.

Preview builds 2 and 3, the production Android transport, and the initial local diagnostic probe use the US host. The European portal URL therefore reveals a concrete regional mismatch hypothesis that was missed during the initial diagnosis. The temporary probe now accepts explicit `--region us|eu` using only the two documented fixed hosts, with no fallback, redirects or retries. No credentials have been supplied to the agent and no live login request has been made by the agent.

**User-reported result:** the EU probe returned the same HTTP 400 / incorrect-credentials result as the US probe. Switching regions alone did not resolve this account's rejection. This does not establish the account's deletion/revocation state or validate the full application integration. The user requested that the other improvements be retained. Monitoring improvements, the regional probe and the regional host findings remain in place. **The shipped APK still uses the US host; application-level EU routing has not been implemented.** Regional routing remains relevant to an EU evaluator even though it did not resolve this particular account's login. Validation with a known-working IFSS account is still required.

The earlier Helium `determineLoginCandidateNamespaces` response (`400`, `H-2102`, `Email not found`) and the displayed `ifss-group` label belong to the portal flow. They do not establish account deletion, a cache fault, or the public API's required namespace. Confirm any namespace nickname from the actual password-login payload or IFSS before changing it. Do not introduce the undocumented Helium endpoint into Latch on this evidence.

## Native login

`POST /auth/login` accepts JSON with required `email:string` (email format) and `password:string`; optional `namespaceId:integer` **or** `namespaceNickname:string` (1–255 characters), never both; optional `mfa:{totpCode:string}` (the object requires `totpCode`); and optional `forMobileLogin:boolean`. No semantics for `forMobileLogin` are documented. The guide specifies the current six-digit authenticator code in `mfa.totpCode`. [Login schema](https://openpath.readme.io/reference/login), [MFA guide](https://openpath.readme.io/docs/using-the-api)

The sole declared response is `201`, with this relevant shape (the `?` marks optional schema properties, not literal JSON):

```text
{
  data?: {
    identityId?: number,
    identity?: { id: number, namespace?: { id: number, nickname?: string } },
    token?: string,
    tokenScopeList?: [{
      org?: { id: number|null, name?: string|null, ... },
      user?: { id: number|null, opal?: string|null, needsMFACredential?: boolean },
      scope?: string[]|null,
      scopeWithContext?: [{
        context?: [{ mfa?: boolean, needsMFACredential?: boolean, fsa?: boolean }],
        scope?: string[]
      }],
      ...
    }],
    createdAt?: string(date-time),
    expiresAt?: string(date-time)|null
  },
  meta?: ResponseMeta
}
```

`TokenScopeList` is a referenced array schema. Its row has no required fields; present `org` and `user` objects require `id`, and those IDs explicitly permit null. Login's `identity` contains **no email or personal name fields**. Organization name can be null or absent. Reject missing app-required data rather than inventing a context or treating null IDs as usable. The schema's permissive `required` lists do not guarantee a complete usable session. [Login schema](https://openpath.readme.io/reference/login)

## Header-authenticated restoration and profile

No `GET /auth/me`, `/identities/self`, or generic `describeIdentity` operation appears in the inspected public reference inventory. Its `identities` group contains nickname list/update operations only. The documented token description and validation endpoints put the token in their URL path; do not substitute a guessed header-only variant. [Identity reference group](https://openpath.readme.io/reference/identities), [token description](https://openpath.readme.io/reference/describeaccesstoken), [token validation](https://openpath.readme.io/reference/validateaccesstoken)

`GET /orgs/{orgId}/users/{userId}` is a documented header-authenticated read, with integer path parameters, optional `options:string`, and `200 {data?: OrgUser, meta?: ResponseMeta}`. Its scopes include self-user `o{orgId}-user{userId}:r` and `:w`. Relevant exact `OrgUser`/`Identity` properties are below; only each object's `id` is schema-required. [Describe user schema](https://openpath.readme.io/reference/describeuser)

```text
data: {
  id: number,
  status?: "I"|"A"|"S",
  hasRemoteUnlock?: boolean,
  startDate?: string(date-time)|null,
  endDate?: string(date-time)|null,
  identity?: {
    id: number,
    email?: string,
    firstName?: string|null, middleName?: string|null,
    lastName?: string|null, fullName?: string|null,
    users?: [{
      id: number,
      status?: string,
      startDate?: string(date-time)|null,
      endDate?: string(date-time)|null,
      org?: { id: number, name?: string|null },
      ...
    }],
    namespace?: { id: integer, org?: {id: number, name?: string}, ... },
    ...
  },
  ...
}
```

There is **no outer `data.org`** in this schema. For the current user/org name use `data.identity.users[]` matched to both the requested user ID and org ID; `identity.namespace.org` describes the namespace and must not automatically stand in for every association. This read does not return `tokenScopeList`, token creation time, or token expiry. [Describe user schema](https://openpath.readme.io/reference/describeuser)

**Implementation inference:** persist login-derived org/user IDs as lookup hints alongside the saved identity, then use header-authenticated `describeUser` reads to check that returned user and identity IDs match and to recover canonical profile/current association data. Missing or mismatched data must fail closed. These hints convey no permissions; every later read/unlock remains provider-authorized. This is a bounded restoration design using documented reads, not a documented vendor “restore session” API.

The documented alternative `POST /auth/accessTokens/refresh` uses header JWT, no body or parameters, and returns `201` with the same token/context schema as login. It **creates a new token and invalidates the old token**. It is not a read-only check and does not fit a policy of no automatic refresh. [Refresh schema](https://openpath.readme.io/reference/refreshlogin)

## Entry discovery

`GET /orgs/{orgId}/users/{userId}/entries` declares only its two required integer path parameters: **no limit, offset or cursor is declared**. Its only response is `200` with top-level optional `totalCount:integer`, `filteredCount:integer`, `data:array`, and `meta`. Relevant entry shape: [Entry schema](https://openpath.readme.io/reference/listuserentries)

```text
{
  id: number,
  name?: string,
  zone?: {
    id: number,
    name?: string,
    offlineEntryCount?: integer,
    site?: { id: number, name?: string }
  },
  wirelessLock?: object|null
}
```

Each present object requires its own `id`; `name`, zone, and site themselves are optional. Counts are **top-level**, not inside `meta` or `data`. No public schema guarantee of completeness or default pagination was found beyond these fields. Requiring complete names/context and counts consistent with all returned records is an app safety policy; inventing pagination parameters for this operation is not evidence-backed. Self-user read scope `o{orgId}-user{userId}:r` is among its documented alternatives. [Entry schema](https://openpath.readme.io/reference/listuserentries)

## Existing credentials and pagination

`GET /orgs/{orgId}/users/{userId}/credentials` declares integer path IDs plus optional `limit:integer` (1–1000), `offset:integer` (minimum/default 0), `sort:string` (default `id`), `order:string` (default `asc`), `q`, `filter`, and `preFilter`. Its `200` response has top-level optional `totalCount:integer`, `filteredCount:integer`, `data:UserCredential[]`, and `meta`. No cursor parameter is declared. [Credential schema](https://openpath.readme.io/reference/listcredentials)

The pagination guide says to advance offset by the number of returned results and continue until an empty `data` array. Counts can also expose inconsistency; rejecting an incomplete traversal or a changing/duplicate result set is an app policy. Do not assume a short nonempty page proves exhaustion. [Pagination guide](https://openpath.readme.io/docs/results-pagination)

Relevant `UserCredential` properties: [Credential schema](https://openpath.readme.io/reference/listcredentials)

```text
{
  id: number,
  startDate?: string(date-time)|null,
  endDate?: string(date-time)|null,
  credentialType?: { id: number, name?: string, modelName?: string },
  cloudKey?: { id: number, name?: string|null, maxDurationSeconds?: number|null },
  ...
}
```

The schema identifies credential variants with an `else.oneOf` whose branches require exactly one of `mobile`, `card`, `pincode`, `cardMifareCsn`, `cardOpenpathDesfireEv1`, `cloudKey`, `fobAllegion`, `allegionMobile`, `licensePlate`, or `wallet`. Each recognized object except `licensePlate` requires its own `id`. `credentialType.modelName` and `name` are arbitrary strings, **not enum discriminators**; no universal numeric Cloud Key type ID is established. Identify the returned `cloudKey` variant, reject contradictory variants, and use the **outer `UserCredential.id`** for the unlock path. `cloudKey.id` is nested model identity. Validity fields are on the outer credential. No Cloud Key `status`, `isActive`, or revocation flag is declared. Local date checks cannot establish final server authorization. [Credential schema](https://openpath.readme.io/reference/listcredentials)

## Unlock and errors

`POST /orgs/{orgId}/users/{userId}/credentials/{credentialId}/cloudKeyEntryUnlock` has integer path IDs and JSON body `{entryId:number, description?:string|null}`; `entryId` is required and `description` has maximum length 100. It declares **only `204`**, with description `No Content` and no content schema. Do not call `response.json()` for that success. Accepted scope alternatives are `o{orgId}-user{userId}:w`, `o{orgId}-user:w`, `o:w`, and `s-o:w`. No idempotency key, polling ID, retry guarantee, controller confirmation, or physical-door result is documented. [Unlock schema](https://openpath.readme.io/reference/cloudkeyentryunlock)

**Error limitation:** the inspected login, refresh, user, entry, credential and unlock schemas declare only their success response. The authentication guide documents sending TOTP but **does not document the error envelope, HTTP status, error name or machine code** for required/invalid TOTP, invalid password, SSO-required accounts, token invalidity, or unlock denial. No official public error catalog was found in the guide/reference inventory. Consequently names such as `MFA_REQUIRED`, `InvalidTotpError`, `SSO_REQUIRED` or an assumed `{error:{code}}` envelope are **not established contracts** and must not become “official” fixtures. Generic status handling and safe login failure are possible; specific required/invalid MFA and SSO classification needs provider evidence or explicitly labeled assumptions. Do not infer MFA-required solely from a generic `401` or by searching arbitrary provider message text. [Login schema](https://openpath.readme.io/reference/login), [authentication guide](https://openpath.readme.io/docs/using-the-api), [unlock schema](https://openpath.readme.io/reference/cloudkeyentryunlock)

## Reproduction and evidence boundaries

Successful public reference HTML reads were saved under `/tmp/openpath-{slug}.html`; extracted operation schemas under `/tmp/openpath-{slug}-schema.json` for `login`, `describeuser`, `refreshlogin`, `describeaccesstoken`, `listuserentries`, `listcredentials`, `cloudkeyentryunlock`, and `listidentitynicknames`. These temporary files are supplementary and are not needed to understand this note. The login document reports `updated_at:2026-09-16T21:33:38.000Z`; its source API-definition metadata reports `updated_at:2026-10-09T22:28:06.546Z`. These are documentation timestamps, not evidence of a live tenant response. [Login reference](https://openpath.readme.io/reference/login)
