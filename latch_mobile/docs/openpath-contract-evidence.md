# Phase 5 Openpath contract evidence

Checked **2026-11-15** against official public Openpath ReadMe pages and the OpenAPI JSON embedded in each page's `script#ssr-props` → `document.api.schema`. No tenant API calls, credentials, tokens, account changes or unlocks were involved. The reference's advertised server is `https://api.openpath.com`; JWT security is an API key in the `Authorization` header, with the raw token and no `Bearer` prefix. [Authentication guide](https://openpath.readme.io/docs/using-the-api), [entry schema](https://openpath.readme.io/reference/listuserentries)

The assessment targets the intended evaluator's supported native account. General portal-disabled employee eligibility is outside this phase's gate. Tenant authorization and Android transport behavior still require their own evidence; schema checks establish neither.

## Regional host investigation — 2026-11-16

The user's portal returns to `https://access.eu.alta.avigilon.com/signin?hasPortalAccess=false`. The route flag expresses the portal's access decision, not an HTTP status or proof of the exact password-login result. A browser application can make a successful HTTP request and then navigate to this route based on response data; a red Network row is not required for a portal denial.

The [Avigilon Alta Access Administrator Guide](https://www.avigilon.com/fs/documents/avigilon-alta-access-administrator-guide-en.pdf), printed page 131 (PDF page index 130), explicitly lists `https://api.openpath.com` for US users and `https://api.eu.openpath.com` for EU users as region base URLs. Current [SCIM integration documentation](https://docs.avigilon.com/bundle/alta-access-identity-management-integrations/page/integrations/okta/okta-scim-sync.htm) also distinguishes these two regional API hosts. These sources establish the documented EU host; they do not by themselves verify this user's `/auth/login` eligibility or response.

Preview builds 2 and 3, the production Android transport, and the initial local diagnostic probe use the US host. The European portal URL therefore reveals a concrete regional mismatch hypothesis that was missed during the initial diagnosis. The temporary probe now accepts explicit `--region us|eu` using only the two documented fixed hosts, with no fallback, redirects or retries. No credentials have been supplied to the agent and no live login request has been made by the agent.

**Corrected user-reported result:** the earlier claim of a controlled US/EU comparison is superseded. The user subsequently clarified that the region flag had been omitted from earlier terminal requests, which therefore used the script's US default. They report that the result still does not change, and supplied a full HTTP 400 response with `errorData.errorCode: H-3120`, `message: Credentials are incorrect.`, and an identical `localizedMessage`. The supplied body does not identify its regional host; retain the printed host with any future comparison. The temporary probe now requires an explicit `--region us|eu` to prevent another silent US-default attempt. Neither this response nor the earlier reports establish the account's deletion/revocation state or validate the full application integration. The user requested that the other improvements be retained. Monitoring improvements, the regional probe and the regional host findings remain in place. **The shipped APK still uses the US host; application-level EU routing has not been implemented.** Validation with a known-working IFSS account is still required.

`H-3120` above is observed evidence for this password-login request, not an official error-code contract or proof of why the credentials were rejected. No official definition was found in the targeted Avigilon/Openpath documentation search. It must not be equated with the browser's `H-2102` response from the separate email-discovery endpoint. The actual browser password-submission request (host, endpoint, status and non-secret namespace/MFA field presence) is still missing from the comparison. Enable Network **Preserve log** before submission so navigation does not clear the relevant requests; successful HTTP requests may also carry the context leading to a portal denial.

The earlier Helium `determineLoginCandidateNamespaces` response (`400`, `H-2102`, `Email not found`) and the displayed `ifss-group` label belong to the portal flow. They do not establish account deletion, a cache fault, or the public API's required namespace. Confirm any namespace nickname from the actual password-login payload or IFSS before changing it. Do not introduce the undocumented Helium endpoint into Latch on this evidence.

### Subsequent browser capture: successful EU authentication

The user's later preserved browser capture supplies stronger evidence, superseding speculation that the displayed organisation necessarily came from stale state:

- `https://helium.prodeu1.openpath.com/cloudServerRegions` lists North America and Europe as distinct environments/endpoints (and other regions). This is observed portal behavior, not a public API integration contract.
- US Helium email discovery returns `400` / `H-2102`; EU Helium discovery returns one matching identity and organisation namespace. The actual returned **nickname is `org:ifss-group`**, not the shorter display name `ifss-group`.
- EU Helium `/auth/login` returns a non-empty token, matching identity/namespace context, expiry, and self-user read/write scopes. The token is intentionally excluded from these notes. The capture establishes that the EU browser flow can authenticate this identity; it does not establish portal access, a valid Cloud Key, Remote Unlock permission, or physical door access. Organisation subscription features in the response are not proof of this user's permissions.
- The captured success response is structurally consistent with the fields the existing public-API adapter consumes. This does not prove endpoint interchangeability, request-field equivalence or the success of the subsequent profile/entry reads.

The next controlled probe is the **documented EU public host** `api.eu.openpath.com`, `/auth/login`, with explicit `namespaceNickname: org:ifss-group`, preserving the user's password/MFA choices. The temporary helper supports `--region eu --namespace org:ifss-group --full-response`; a successful token remains hidden. This verifies the public-host path before changing the application's fixed origin/configuration. Do not forward the browser's captured token to other hosts or infer that Latch must adopt the portal's discovery endpoints. Preview 3 still uses the US public host and omits the namespace, so it does not match the observed EU namespace context.

### Confirmed public login and applied source correction

The user then reported **HTTP 201** from that EU public-host probe with the exact `org:ifss-group` namespace. This supersedes the earlier rejection-only evidence: the verified combination authenticates this account without portal access being restored. It does not independently identify which of the previous region/namespace omissions caused each failed request, nor prove any subsequent API operation or door permission.

At the user's request, source now uses the fixed EU native origin and the verified namespace default, with the same namespace explicitly set in the preview profile. Live secure session and attempt storage is partitioned by EU context and configured namespace, so legacy US credentials cannot be hydrated into the corrected provider. Existing demo storage is unchanged. **No replacement APK was built during the initial correction**, as explicitly requested. The user later approved preview **1.0.0 (4)** after UX refinements; its DEX and Hermes bundle now confirm the EU origin and exact namespace. See [artifact evidence](apk-eu-preview-evidence.json). The above references to preview 3's US host remain accurate for that older artifact. Verification of the initial corrected source: **155 JavaScript tests**, lint/typecheck and **10 JVM transport fixtures** passed; **156 JavaScript tests**, lint/typecheck passed before preview 4 upload. Profile, entry, Cloud Key and unlock compatibility on the corrected phone build remain unverified.

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

There is **no outer `data.org`** in this schema, and **`identity.users` is optional**. When that list is present, match it to both the requested user ID and org ID. When it is absent, the observed EU shape below supplies `identity.namespace.org`: use that organisation only if its numeric ID exactly equals the login-derived organisation for this own-user read. It must not stand in for another association, and cannot bypass an explicit malformed, empty, duplicate or contradictory `identity.users` list. This read does not return `tokenScopeList`, token creation time, or token expiry. [Describe user schema](https://openpath.readme.io/reference/describeuser)

**Implementation inference:** persist login-derived org/user IDs as lookup hints alongside the saved identity, then use header-authenticated `describeUser` reads to check that returned user and identity IDs match and to recover canonical profile/current association data. Missing or mismatched data must fail closed. These hints convey no permissions; every later read/unlock remains provider-authorized. This is a bounded restoration design using documented reads, not a documented vendor “restore session” API.

### Observed EU profile and parser correction

On 2026-11-16, preview 4 Sentry logs showed accepted login **201** followed by profile **200** rejected at `response-validation` (latest observed pair at **17:59:13–14 Nairobi / 14:59:13–14 UTC**). The user-run profile script then established the precise failure: `data.identity.users` is absent. User ID, identity ID, email and full name passed the original checks; `identity.namespace.org` contains a name and matches the login-derived organisation ID. The response also reports status `A` and `hasRemoteUnlock: true`; those fields alone do not prove own Cloud Key availability or COE-specific eligibility. No portal-permission rejection is demonstrated by this sequence.

The initial schema review correctly recorded that only object IDs are required, but the adapter and synthetic fixtures incorrectly treated the optional user-association expansion as mandatory. This was an unverified implementation assumption. The correction accepts the captured shape only under the exact identity/user/organisation conditions above. The committed regression uses fictional IDs, email and names; the user's response and token are not copied into the repository.

Successful HTTP responses that cannot be decoded or verified now produce the fixed `invalid-response` classification and the message **“Alta returned a response Latch could not verify. Try again or contact IFSS.”** Transport/status policies and identity-mismatch expiry behavior remain separate. Sentry permits only this additional fixed classification, with response bodies and account data still excluded. The local script mirrors the corrected profile check; offline replay of the existing report now passes without another API request.

Verification: **169 JavaScript tests / seven suites**, lint and typecheck passed. The observed-shape login/restoration regression failed before the fix and passes afterward; the actual-screen invalid-response message likewise failed before its correction. Negative cases cover different user/identity IDs, wrong or string namespace org IDs, missing/empty organisation names, missing namespace data, and malformed/empty/contradictory/duplicate explicit associations. A live fixture journey uses the namespace-only profile through the real screens, including MFA and the existing unlock lifecycle.

The correction was initially held in source after preview 4, then the user approved a new build. Preview **1.0.0 (5)** now packages the fix from source commit `d4f9226`; signature, version, EU origin, namespace and new response-validation guidance were verified in the APK. See [artifact evidence](apk-profile-preview-evidence.json). No app launch, real login or unlock was performed by the agent. Live device acceptance and downstream entry/credential/unlock compatibility remain distinct from fixture and packaging success.

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
