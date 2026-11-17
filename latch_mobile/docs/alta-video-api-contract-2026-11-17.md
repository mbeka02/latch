# Alta Video API contract investigation — 2026-11-17

Scope: first-party documentation and a separately recorded, limited deployment sign-in investigation. No door commands or application changes were made. Public contract findings below are distinct from observed tenant results at the end. The public Alta Video ReadMe reference declares OpenAPI 3.0 and product API version `8.3.10`; operation pages inspected report updated July 27, 2026. Treat this as a documented contract, not proof of a particular tenant's deployed version or permissions.

## Finding

Alta Video exposes its own integrated access-control server, access-point inventory, and remote-unlock API. This is a concrete alternative to the personal Alta Access CloudKey inventory path. A successful personal Access login returning no user entries does **not** establish whether a Video operator can see and operate integrated access points. The public API documents a Video deployment session cookie; it does not establish that a personal Access JWT is a substitute for that cookie. See the operation contracts below.

## Deployment and authentication

The documented API base is `https://<deployment>/api/v1`, with the actual Video deployment hostname required. The reference server template is `https://{deploymentName}.{region}.{domain}.com`; domains include `alta.avigilon` and legacy `aware.avasecurity`. This is distinct from simply choosing the Alta Access API host. [Video API reference](https://alta-video.readme.io/reference/get_api-v1-about)

`POST /api/v1/dologin` accepts JSON properties `username`, `password`, and `code` (all strings in the published schema). Its description places the resulting session cookie in `Set-Cookie`; success is HTTP 200 with no specified response-body schema. The getting-started guide explicitly describes username/password login and carrying the cookie on subsequent requests. Its example checks `GET /api/v1/auth` for `mfaResetRequired` and `mfaChallengeRequired`, then uses `POST /api/v1/totp` with `{"code":"<TOTP>","name":""}` when challenged. [Login reference](https://alta-video.readme.io/reference/post_api-v1-dologin), [official getting-started guide](https://docs.avigilon.com/bundle/alta-video/page/Integrations/api/api-getstart.htm)

Every discovery and unlock schema inspected defines `CookieAuth` as OpenAPI `type: apiKey`, `in: cookie`, `name: va`, with login via `/api/v1/dologin`. Here “apiKey” describes the OpenAPI cookie scheme; it is **not** evidence that an independently generated API-key header is accepted. No Bearer/JWT authentication scheme is declared on these operations. [Access-point reference](https://alta-video.readme.io/reference/get_api-v1-accesscontrolpoints), [unlock reference](https://alta-video.readme.io/reference/post_api-v1-accesscontrolpoints-id-unlock)

## Inventory and discovery routes

| Operation | Published response / purpose |
| --- | --- |
| `GET /api/v1/accessControlServers` | JSON array of integrated server objects. Relevant properties: `id` UUID, `name`, `provider`, `openpath_org_id` nullable string, `unified` boolean, `region`, `server_group_id` nullable UUID, `username`, `host`, `port`, `tls`, `skip_tls_cert_check`, `custom_params`. Provider enum includes `OPENPATH`, `LENEL`, `VAION`, `FEENICS`, `NEDAP`, `S2`, `CCURE`. Password properties are marked `writeOnly`; this is not an endpoint for obtaining integration passwords. |
| `GET /api/v1/accessControlPoints` | JSON array of configured Video access points: `guid` UUID, `name`, `name_on_server`, `id_on_server` string, `server_guid` UUID, `server_group_id` UUID, `device_group_id` UUID, `label_ids` UUID array, `openpath_url` nullable string, `created` date-time, and `type` (`ACCESS_POINT` or `ARMING_STATION`). `associated_devices` contains `device_id`, `server_group_id`, nullable UUID `source`, and string `source_id`. |
| `GET /api/v1/availableAccessPoints` | JSON array with `access_point_name_on_server`, `id_on_server`, `reader_names` string array, `server_guid` UUID, `server_group_id` UUID, `server_name`. The public schema declares no query parameters. The shape distinguishes provider discovery results from configured Video points with a `guid`. |

Sources: [servers](https://alta-video.readme.io/reference/get_api-v1-accesscontrolservers), [configured points](https://alta-video.readme.io/reference/get_api-v1-accesscontrolpoints), [available points](https://alta-video.readme.io/reference/get_api-v1-availableaccesspoints).

The public sidebar also exposes `GET /api/v1/accessControlPoints/{guid}`, `GET /api/v1/accessControlPointLives`, `GET /api/v1/accessControlServerStatuses`, and `GET /api/v1/accessControlPointsByAssociatedDevice/{id}`. Their detailed schemas were not needed for the inventory/unlock question and were not verified here.

## Remote unlock contract

`POST /api/v1/accessControlPoints/{id}/unlock`

- Path `id` is a required UUID string. The configured-point inventory exposes its Video identifier as `guid`; provider `id_on_server` and personal Access numeric entry IDs are distinct fields and must not be substituted without an explicit mapping.
- JSON request body has optional properties `associated_device_id` (UUID string) and `associated_device_source` (string). Neither these properties nor the request body are marked required in the public schema.
- HTTP 200 is documented. No JSON success-body contract, duration parameter, or detailed error schema is published on this operation page.
- Authentication is the `va` Video cookie as above.

This is a documented command only; it was **not executed**. The inferred inventory-to-command mapping is to use the Video point UUID, confirmed against the target deployment's own API Explorer before implementing an actuator. [Official unlock operation](https://alta-video.readme.io/reference/post_api-v1-accesscontrolpoints-id-unlock)

## Operator permission versus personal credential

The getting-started guide says API requests inherit the same permission model as Video UI users: information visibility and available actions depend on that API user's permissions. It recommends separate consumer accounts and limited permissions. The user-group guide distinguishes System permissions (including an Access Control area) from Device & Zone permissions scoped by sites, device groups, or custom labels. Therefore successful Video sign-in alone does not prove discovery or unlock permission. The public operation schemas above do not identify the exact permission-bit names required by each route; do not invent them or assert that a named default Operator role always has unlock rights. [API permissions guide](https://docs.avigilon.com/bundle/alta-video/page/Integrations/api/api-getstart.htm), [Video user groups](https://docs.avigilon.com/bundle/alta-video/page/Products/aware/users/awarecreateusergroups.htm)

## Unified sign-in and unsupported assumptions

`POST /api/v1/openpathLogin` has no documented request body and returns `{ "host": string, "token": string }`, under the global Video `CookieAuth` scheme. It supplies no field for submitting an existing personal Access token. Its contract supports an already-authenticated Video session obtaining an Openpath token; it does **not** document the reverse exchange. [Openpath login reference](https://alta-video.readme.io/reference/post_api-v1-openpathlogin)

`POST /api/v1/doMobileSSOLogin` accepts `{ "code": string, "code_verifier": string }`; its description says it confirms mobile SSO login and returns a cookie in `Set-Cookie`. This confirms an SSO code path exists, but this operation alone does not specify how to initiate authorization, obtain that code, configure an approved redirect/client, or exchange an Alta Access JWT. Those gaps remain open. A separate native Video username/password account is one documented path; claiming it is the *only* possible user login path would overstate the evidence. [Mobile SSO reference](https://alta-video.readme.io/reference/post_api-v1-domobilessologin)

Remaining unknowns: the deployed Video version; whether the user's identity is enabled there; that identity's inventory and unlock permissions; the integrated server/point mapping; the fully supported unified mobile sign-in initiation contract; whether any accepted JWT/header extension exists outside the published cookie scheme. None of these is resolved by an empty personal Access `/users/.../entries` response, and no tenant misconfiguration conclusion follows from the public research.

## Deployment sign-in investigation

The user confirmed the historical Video deployment hostname from browser history. An unauthenticated `GET /api/v1/about` returned 401; this does not establish the tenant's software version or the user's permissions. The public root HTML returned 200 and referenced public JavaScript sign-in assets. No authenticated UI, camera stream, image, footage, or door command was accessed.

The public sign-in assets identify `GET /api/v1/public/config` and `GET /api/v1/public/lookupUser?username=...` as the deployment's pre-authentication routing operations. Both are also published in the official API reference. Its configuration returned 200 and matches the Access organization and EU API host already used by Latch: region `prodeu1`, sign-in host `alta.avigilon.com`, API host `api.eu.openpath.com`. This establishes that the deployment is configured for unified sign-in; it does not prove a particular user has Video membership. [Public configuration](https://alta-video.readme.io/reference/get_api-v1-public-config), [user routing lookup](https://alta-video.readme.io/reference/get_api-v1-public-lookupuser)

The user ran `scripts/check-alta-video.py` using their own sign-in details. At **2026-11-17 08:26 UTC / 11:26 Nairobi**, its native Video `POST /api/v1/dologin` returned **401**. No Video cookie was established and no authenticated discovery read followed. The original diagnostic retained the JSON key names `kind` and `code` but mistakenly omitted their values; therefore that report cannot distinguish the exact provider error. The script's logging was corrected to retain these error fields, with secret redaction. Do not classify this 401 as missing door permission, wrong password, or proof that the Video identity was deleted.

With the user's explicit approval to send their existing email to the exact confirmed deployment, the agent made the public username lookup. It returned 200 with neither a non-null local identity nor a non-null Openpath identity, and a nonce present. Only these routing facts were saved; neither the email nor nonce was saved in the routing-summary artifact. The public sign-in client routes a non-null Openpath lookup result to unified sign-in. A null result is not sufficient evidence to name the underlying administrative/account cause, and the script's rejected local login does not test door visibility.

The public client also includes an internal `setOpenpathCookie` callback model with JWT/nonce/redirect fields. It is observed frontend implementation evidence, **not** a verified supported native Access-token exchange: its token's audience, issuance and binding have not been established, and the public inventory inspected does not document that callback operation. No personal Access JWT was submitted to that route. Do not ship a guessed token exchange based on its name.

The user subsequently confirmed that the Video browser sign-in also reports invalid credentials, while Access browser authentication succeeds and then redirects because portal access is disabled. They further confirmed that no unified sign-in option is visible on the Video page. Thus the available browser flow and the native diagnostic both fail before Video inventory can be read; a successful unified Video session has not been tested. The absent option is consistent with the negative routing lookup, but does not identify its cause or prove account deletion. Neither result justifies changing the working Access authentication or silently adopting shared administrator credentials.

### Current decision and next evidence

Keep Latch's architecture unchanged. The Video API is a verified alternative route to integrated door discovery and commands, but whether this user can access COE through it remains untested. The personal Access inventory is empty, not evidence that the Video inventory is empty. Do not repeat the same password attempts or make another APK to investigate that distinction.

The next useful external check is for IFSS to confirm the user's current Video membership and intended sign-in method for the exact confirmed deployment, or identify the intended direct Access entry/permission path if Video access is intentionally unavailable. This requires neither administrator access for the applicant nor a shared integration credential. Once an authorized Video session is available, use the script to read configured points, confirm the COE mapping and route permissions, then separately review and authorize a single unlock test. No end-to-end unlock success is claimed yet.

### Read-only Video diagnostic

```sh
python3 scripts/check-alta-video.py --origin https://YOUR-CONFIRMED-VIDEO-HOST --output /tmp/latch-video-report.json
```

The diagnostic uses a strict route allowlist containing only documented auth/MFA and access-control reads. An unlock path is rejected before opening a connection. Cookies stay in memory; integration credentials, camera association metadata and token-bearing access links are omitted. It refuses redirects, retries and MFA enrollment/reset. Its MFA implementation accepts a user-entered current authenticator code only. Reports are new local files with permissions `0600`; they still contain account and door metadata.

Offline checks verified cookie propagation only to the configured origin, native-login/MFA gates, configured-point array handling, integration-secret removal, rejection of unsupported origins and physical-unlock routes, and stopping on MFA-reset requirements. Lint and typecheck passed. No successful Video-session discovery, readable Video inventory, or physical unlock is claimed by these fixture checks.

## Follow-up: unified sign-in is a separate supported user flow

The official **Sign in to Alta Video** page explicitly directs unified Video/Access deployments to the **unified sign-in screen**, referring to a separate topic titled “Sign in to Alta Video as a unified user.” It lists email/password, 2FA, and SSO as configuration-dependent alternatives. Consequently, failure of a native Video `/dologin` password attempt does **not**, by itself, rule out the supported unified identity flow. That is a conclusion about authentication paths, not a claim that this particular account is authorized for Video. [Official Video sign-in guide](https://docs.avigilon.com/bundle/alta-video/page/Products/aware/_common/login.htm)

The Access administrator sign-in guide identifies `https://alta.avigilon.com/signin`, organization/region selection, and enabled identity-provider SSO. For organizations unified across Video and Access, it says the **Alta Access password** is used and the old Video password is no longer used across the two systems. It also requires normal browsing mode for app-switching links used by Video SSO users. This is first-party evidence that preserving a unified Access identity is supported at the browser-product level; it does not make a mobile CloudKey or Access API JWT a Video API cookie. [Official Access sign-in guide](https://docs.avigilon.com/bundle/alta-access-admin/page/alta-access/sign-in.htm)

The official DMP unified-user guide additionally documents email-first sign-in, selecting the applicable identity/data region when multiple identities exist, then password/2FA or SSO. This corroborates identity-selection behavior for **DMP**, not a substitute contract for the Video deployment callback. [DMP unified-user guide](https://docs.avigilon.com/bundle/alta-video/page/Products/dmp/users/unified-users/dmp-unified-users-sign-in.htm)

**Contract limit:** The publicly retrievable guides inspected do not specify a supported OAuth client registration, authorization URL parameter contract (`service`, `orgId`, `redirectUrl`, `nonce`), or a `setOpenpathCookie` API accepting arbitrary Access JWTs. The exact destination of the separately named Video unified-user topic was not resolved by the public index. Therefore neither a forced `service=aware` URL nor direct calls to an internal cookie-setting route are established as supported by this research. A deployment's public configuration and a negative email-lookup result can guide diagnosis, but the official sources above do not define those lookup results as a universal account-availability or entitlement verdict. Keep native authentication failure, unified identity selection, and Video authorization as separate findings until the supported flow returns a definitive result.
