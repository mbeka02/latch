# Openpath discovery index audit — 2026-11-17

Public documentation research only. No tenant requests, Video API requests, credentials, unlocks, script edits or configuration changes. This supplements the [alternative discovery](alta-alternative-door-discovery-2026-11-17.md) and [second pass](alta-contract-second-pass-2026-11-17.md) notes rather than repeating their observed tests. The official [llms.txt index](https://openpath.readme.io/llms.txt) was fetched directly (653 lines), then relevant linked `.md` pages were fetched and their embedded OpenAPI JSON inspected. Temporary source snapshots are `/tmp/openpath-index-audit-*.md` and `/tmp/openpath-index-audit-llms.txt`.

**No overlooked public own-user door-discovery operation was found. Several organization inventories remain uncalled; their authorization must not be reported as an observed denial just because organization entries returned 403.** All scope statements below describe the published contract, not tenant behavior. An inventory mapping identifies an entry; it does not establish personal permission to unlock it.

## Additional own-account reads: concrete, but no target mapping

| Untested contract | Scope/prerequisite | Declared useful response and limit |
| --- | --- | --- |
| `GET /orgs/{orgId}/users/{userId}/roles` | Accepts exact own-user `o{orgId}-user{userId}:r`. Use login-derived IDs. | Role `id`, optional `name`, `isMfaRequired`, `isSiteSpecific`; no entries, sites or role scopes in each row. Could independently check a reported role, especially a different account claiming Super Admin; cannot discover a door. Pagination: `limit` 1–1000, `offset` >=0 default 0, `sort=name`, `order=asc`. [Contract](https://openpath.readme.io/reference/listuserroles.md) |
| `GET /orgs/{orgId}/users/{userId}/preferenceSet` | Accepts exact own-user `:r` or `:w`; only org/user path parameters. | Only `videoTimestamp`, `preferredMeasurementUnits`, `playAlarmNotificationSound`, `alarmNotificationSoundVolume`. No favorite entries or intercom routing. No discovery value. [Contract](https://openpath.readme.io/reference/describeuserpreferenceset.md) |
| `GET /identities/{identityId}/nicknames` | Requires identity scope `i{identityId}:r`/`:w` or global `i:r`/`:w`; own-user scope alone is not listed. | Rows contain only `nickname`; no namespace, user, organization or entry IDs. Does not enumerate identity contexts. [Contract](https://openpath.readme.io/reference/listidentitynicknames.md) |
| `GET /auth/accessTokens/{token}` | Requires the existing token as a path parameter. | Identity/namespace, tokenScopeList and token dates; no door inventory. This largely duplicates current login evidence. Do not put a live token URL in logs or saved reports. [Contract](https://openpath.readme.io/reference/describeaccesstoken.md) |

The roles endpoint is the only newly identified own-user read here with a plausible diagnostic purpose. It would answer a role/context claim, not repair empty personal entries. The already-inspected own-user intercom notification preferences contain no route or target, and the current credential detail omitted its optional `user` expansion in the recorded tenant result. Those findings remain unchanged.

## Uncalled organization inventories with explicit mapping value

For compactness, scope examples below use `o{orgId}-resource:r`. **These are examples of accepted alternatives, not the complete scope lists.** Each linked full contract lists all alternatives. Every route in this table also accepts global `o:r` or `s-o:r`, and none lists exact own-user `o{orgId}-user{userId}:r`/`:w`. All accept `limit` 1–1000 and `offset` >=0, default 0. A bounded future read can use `limit=100&offset=0` and page only successful responses; no guessed IDs or query expansions are needed.

| Uncalled `GET` route | Examples of accepted org read scopes | What it can actually reveal |
| --- | --- | --- |
| `/orgs/{orgId}/readers` | `hw:r`, `site:r`, `siteGeneral:r`, `admin:r`, `dash:r`, `quickStart:r`, `rpt:r` | `entries:[{id,name}]`, reader ID/name and `acuPort.acu`. No special option is required for the declared entry projection. `options` permits `withEffectiveLocationRestriction`, `excludeVideoReaders`, `onlyVideoReaders`; none grants authorization. [Contract](https://openpath.readme.io/reference/listreaders.md) |
| `/orgs/{orgId}/relays` | `hw:r`, `site:r`, `siteGeneral:r`, `admin:r`, `quickStart:r` | `entries:[{id,name}]` and `acuPort.acu`; a real alternate hardware-to-entry mapping. [Contract](https://openpath.readme.io/reference/listrelays.md) |
| `/orgs/{orgId}/zones` | `user:r`, `site:r`, `siteGeneral:r`, `ldp:r`, `dash:r`, `dashActivity:r`, `dashCust:r`, `musterReport:r`, `occupancyReport:r`, `rpt:r` | Owned/shared zone IDs/names, site and `entries` with ID/name/ACU reference. Distinct from the already-empty own-user `/zones`. [Contract](https://openpath.readme.io/reference/listzones.md) |
| `/orgs/{orgId}/acuPorts` | `site:r`, `siteGeneral:r`, `hw:r`, `admin:r`, `outboundWebhooks:r`, `configurations:r`, `quickStart:r` | Reader/relay/contact-sensor/REX/Wiegand/third-party-reader nested objects can contain `entries:[{id,name}]`. One inventory can cover multiple associated hardware types. [Contract](https://openpath.readme.io/reference/listallacuports.md) |
| `/orgs/{orgId}/thirdPartyReaders` and `/thirdPartyWiegands` | `hw:r`, `site:r`, `siteGeneral:r`, `admin:r`, `quickStart:r` | Each declares `entries:[{id,name}]` and ACU-port context. Relevant only if intended hardware uses OSDP/Wiegand integration. [OSDP contract](https://openpath.readme.io/reference/listthirdpartyreaders.md), [Wiegand contract](https://openpath.readme.io/reference/listthirdpartywiegands.md) |

## Uncalled inventories with weaker immediate value

- `GET /orgs/{orgId}/acus`: accepted org reads include `role:r`, `user:r`, `admin:r`, `site:r`, `siteGeneral:r`, `rpt:r`, `dash:r`, `dashActivity:r`, `dashCust:r`, `hw:r`, `outboundWebhooks:r`, `configurations:r`, `quickStart:r`. Returns controller IDs/names, owning/assigned org, `entryCount`, optional `acuPorts` with `opvideoDevice.id`. **This organization's ACU-list schema does not declare the own-user ACU schema's `shadow.state.reported.entries` mapping**; its shadow `state` is declared as an empty object. Do not promise entry IDs from this contract. [Contract](https://openpath.readme.io/reference/listacus.md)
- `GET /orgs/{orgId}/sites`: accepts many broader org scopes including `role:r`, `admin:r`, `hw:r`, `user:r`, `site:r`, `siteGeneral:r`, `rpt:r`, `dash:r`. Returns site IDs/names and `zoneCount`, plus optional groups/resources; no entries array. Useful context only. [Contract](https://openpath.readme.io/reference/listsites.md)
- `GET /orgs/{orgId}/wirelessLockReaders`: accepts `integrations:r`, `site:r`, `admin:r`, `siteGeneral:r`, `hw:r`, `dash:r`, `dashEntry:r`, `dashActivity:r`. Reader/provider/third-party-device metadata; no declared direct entry mapping. This is a distinct uncalled inventory from the three wireless routes already denied. [Contract](https://openpath.readme.io/reference/listwirelesslockreaders.md)

## Intercom, operator and mobile exclusions

The full index has no separate public intercom call-route/operator-to-entry or “access control points” listing operation. This is a statement about this public index, not proof no internal/mobile/vendor API exists. The indexed wireless-provider “operators” endpoint is `GET /orgs/{orgId}/wirelessLockProviders/{wirelessLockProviderId}/operators`: requires a known provider ID plus `integrations:r`, `hw:r`/`:w`, `o:r` or `s-o:r`; returns user name, role, names and operator ID, **no entries**. It is not an intercom-operator discovery API. [Index](https://openpath.readme.io/llms.txt), [operators contract](https://openpath.readme.io/reference/listwirelesslockprovideroperators.md)

`GET /orgs/{orgId}/users/{userId}/noTourCredentialSectors/validationData` is another indexed user-path endpoint, but requires broader `user:r`/`:w`, `dash:r`/`:w`, `credential:r`/`:w`, global `o:r`/`:w` or `s-o:r`/`:w`; it lists no exact own-user scope. It concerns no-tour credential validation and can return credential material; it is a poor Cloud-Key-only target discovery probe. [Contract](https://openpath.readme.io/reference/listorgnotourcredentialsectorsvalidationdata.md)

`POST /orgs/{orgId}/users/{userId}/credentials/{credentialId}/generateSetupMobileToken` accepts own-user `:w`, but creates a `setupMobileToken`; its response supplies no entries. It is a provisioning action, not a read-only discovery API, and its existence does not make a Cloud Key a mobile credential. The SDK access prerequisite remains the public overview/account-manager distribution described in the earlier note. [Token contract](https://openpath.readme.io/reference/generatesetupmobiletoken.md), [SDK overview](https://openpath.readme.io/docs/mobile-sdk.md)

The earlier `effectiveScopes` finding also stands: no exact own-user scope is listed. If a different already-authorized administrative context exists, its `allowedOperationIds` response could select appropriate inventories before attempting them; it is not established as callable under this account. [Contract](https://openpath.readme.io/reference/geteffectivepermissionsfororg.md)

**Practical implication:** the uncalled readers/relays/zones/ACU-port inventories are concrete public alternatives for discovering mappings with broader authorization. They remain tenant-untested, not eliminated by a different endpoint's 403. No newly documented own-user target lookup, required mobile flag, intercom ID substitution or tiny client fix emerged from this audit.
# Targeted diagnostic implementation

## Observed result

The user's run at 2026-11-17 12:01 UTC returned login 201 and own-profile 200. All three organization inventory reads (`readers`, `relays`, `zones`) returned **403 / H-4000**, each explicitly reporting missing listing permissions. No inventory page or entry reference was obtained. These were denied reads, not empty successful inventories; no pagination or name filter caused the result. This establishes that this token cannot inspect those inventories, not that the user cannot unlock a particular door. It supplies no raw evidence from Mohamed's account and no verified application fix. No unlock was sent.

Run locally with your own account:

```sh
python3 scripts/check-alta-access.py --hardware-discovery-only --output /tmp/latch-alta-hardware-discovery-2026-11-17.json
```

This mode performs one EU login and own-profile validation, then independently pages organization `readers`, `relays`, and `zones` using documented name sorting. It deduplicates organizations, bounds each inventory to six pages of 100, retains unfiltered entry IDs/names and source mappings, and distinguishes omitted entry expansions from empty arrays. Denials and incomplete traversal remain explicit. Hardware configuration, serial numbers and credential material are omitted. No Video requests, retries, redirects or unlock commands are sent. Reports use the existing new-file, redacted, mode-0600 output handling.

Offline HTTP-boundary checks passed for pagination, exact request paths and sort, organization deduplication, an explicit 403 alongside successful mapping, absent versus empty expansions, independent timeout handling and secret omission. This verifies the diagnostic only; no live result is claimed yet.

