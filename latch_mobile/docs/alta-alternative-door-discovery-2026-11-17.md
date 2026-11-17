# Alternative Alta door discovery — 2026-11-17

Fresh official Openpath public-reference research only; no tenant requests, token use, configuration changes or unlocks. Scope comparisons below concern the observed token containing **own-user** `o{orgId}-user{userId}:r` and `:w`; they do not claim every endpoint needs an administrator. Extracted schemas are `/tmp/alta-alt-{slug}.json`, supplemented by the earlier `/tmp/alta-recheck-{slug}.json` files. `/tmp/alta-reference-props.json` is a Video reference snapshot despite its filename; this investigation used the Openpath sidebar in `/tmp/alta-current-listuserentries-props.json`.

## Answer

**The door can appear through other objects, but Openpath's documented physical-unlock target remains an entry.** A reader, intercom or controller represents associated hardware; a zone groups entries and grants access; a credential authorizes requests. The official model defines an entry as the logical physical access point associated with readers, relays, contact sensors and other controls. Shared zones still contain entries. Thus a different hardware listing could expose an entry reference without establishing a second kind of Cloud Key door target. [Official resource model](https://openpath.readme.io/docs/key-concepts)

There are two additional own-user reads worth distinguishing from the empty user-entry list: **user ACUs can contain entry IDs in controller shadow data**, and **own-user activity can contain historical entry IDs/names**. Neither is a documented replacement inventory of entries the user may currently unlock. [User ACUs](https://openpath.readme.io/reference/listuseracus), [user activity](https://openpath.readme.io/reference/getuseractivity)

## Documented alternatives

| Object / read | Available to observed own-user token in schema? | What it can establish / limitation |
| --- | --- | --- |
| `GET /orgs/{orgId}/users/{userId}/entries` | Yes, own-user read. | Canonical described list of entries the user can access. Only the two path parameters are declared; no remote/mobile/credential query switch. An empty response has no documented implication that a reader ID should replace an entry ID. [Contract](https://openpath.readme.io/reference/listuserentries) |
| `GET /orgs/{orgId}/users/{userId}/acus` | Yes, own-user read. | Controller objects can include name, `org`, `ownedByOrg`, and optional `shadow.state.reported.entries`, an object with numeric-string keys. Each value may contain `currentEntryState` and `schedule`; **no entry name is declared there**. These are reported controller references, not an explicit user-entry grant list; inclusion and freshness are not guaranteed. [Contract](https://openpath.readme.io/reference/listuseracus) |
| `GET /orgs/{orgId}/users/{userId}/reports/activity` | Yes, own-user read, also a dedicated activity scope. | `AccessEvent` can include `entryId`, `entryName`, an `entries` array with IDs/names/zone/site, and ACU/reader fields. This may identify a previously operated target if the event belongs to this user. Historical references do not establish current access; events attributed to another integration actor may be absent. [Contract](https://openpath.readme.io/reference/getuseractivity) |
| Own-user `/zones`, `/zoneUsers`, `/sites`, `/groups` | Yes, own-user read. | Zones/groups/sites identify associations; `zoneUsers` also supplies nullable schedule objects. These small response schemas do not contain an entry inventory. Their names/descriptions do not fully specify direct versus inherited/effective assignment calculations. [Zones](https://openpath.readme.io/reference/listuserzones), [zone configurations](https://openpath.readme.io/reference/listuserzoneusers), [sites](https://openpath.readme.io/reference/listusersites), [groups](https://openpath.readme.io/reference/listusergroups) |
| Own-user `/credentials`, `/credentials/{credentialId}` | Yes, own-user read. | The Cloud Key variant contains `id`, optional `name` and `maxDurationSeconds`, **no entries array**. Mobile metadata is provisioning/device information, not an entry inventory. Some other credential variants' no-tour commands can reference wireless locks with a nested entry; this does not describe the reported Cloud-Key-only inventory. Optional nested `user.groups.opvideoIntercomProfiles` can contain intercom IDs/names, but no entry ID in that expansion. Optional schema fields are not guaranteed expansions. [List](https://openpath.readme.io/reference/listcredentials), [detail](https://openpath.readme.io/reference/describecredential) |
| Own-user `/intercomNotificationPreferenceSet` | Yes, own-user read/write accepted for GET. | Only `notificationMethod` and nullable `phoneNumber` are declared in `data`; no intercom, route, reader or entry target. Do not collect the phone number to discover a door. [Contract](https://openpath.readme.io/reference/describeuserintercomnotificationpreferenceset) |
| Organization `/mobileAppConfig` | Own-user read/write not listed. | Its response only declares `isBadgeViewEnabled`; no door inventory. [Contract](https://openpath.readme.io/reference/describemobileappconfig) |
| Organization `/readers`, `/readers/{readerId}` | Own-user read/write not listed. | Hardware reads can contain `entries:[{id,name}]` and ACU association. The list supports `onlyVideoReaders`/`excludeVideoReaders` options, but those do not confer scopes. Useful to an appropriately authorized investigator, not a supported ordinary-token fallback. [List](https://openpath.readme.io/reference/listreaders), [detail](https://openpath.readme.io/reference/describereader) |
| Organization `/zones`, `/zones/{zoneId}`, zone `/shares` | Own-user read/write not listed. | Owned/shared zone responses can contain entries and ACU IDs; sharing links organizations through zones. This remains entry-based discovery under broader scopes. [List](https://openpath.readme.io/reference/listzones), [detail](https://openpath.readme.io/reference/describezone), [shares](https://openpath.readme.io/reference/listzoneshares) |
| Group detail, `/groups/{groupId}/entries`, `/zones`, `/zoneGroups` | Own-user read/write not listed. | Can inspect the already known group's physical access with suitable authorization. A bounded read probe may return 403, which proves inability to inspect with that token, not absent group access. Do not invent group IDs or use visibility-bypass options. [Entries](https://openpath.readme.io/reference/listgroupentries), [zones](https://openpath.readme.io/reference/listgroupzones), [configuration](https://openpath.readme.io/reference/listgroupzonegroups) |

No distinct public Openpath intercom-device or call-route enumeration endpoint was found in the inspected reference navigation. The optional profile nesting above establishes that intercom objects exist; it does not document a route from an intercom ID to an unlockable target under the own-user token. Absence from this public inventory is not proof that vendor/internal/mobile SDK APIs do not exist.

## Unlock target contracts

The own-user Cloud Key unlock operation requires `entryId` in its body and the outer user credential ID in its path. It does not accept `readerId`, `acuId`, `opvideoIntercomId`, zone ID or group ID as substitutes. [Cloud Key entry unlock](https://openpath.readme.io/reference/cloudkeyentryunlock)

Both documented Cloud Key token-generation variants require an `entryId` or `entryData` containing entry IDs. One locates the credential by the outer credential ID; the other by the nested Cloud Key model ID. This changes credential addressing, not the target type. Token generation creates an authorization artifact and is not a read-only discovery technique; the token-use operation performs the unlock. [Generate by credential ID](https://openpath.readme.io/reference/generatecloudkeyunlocktoken), [generate by model ID](https://openpath.readme.io/reference/generatecloudkeyunlocktokenbymodelid), [use token](https://openpath.readme.io/reference/usecloudkeyunlocktoken)

The reference also has hardware identify/restart and entry state/lockdown commands. Their existence does not establish an ordinary-user unlock command targeting a reader or controller. No such alternative physical-unlock target contract was found in this inventory.

## Practical next reads

1. Page the documented own-user ACU list, preserving only controller IDs/names, organization context, and numeric entry-reference keys already returned in optional shadow data. Use documented pagination (`limit` 1–1000, `offset` default 0, `sort` default `name`, `order` default `asc`). Do not request shadow refresh, infer a controller's every entry belongs to the user, or treat `currentEntryState` as authorization.
2. If historical identification remains useful, make a **bounded own-user activity read**, for example `limit=20&offset=0&sort=time&order=desc`. All four parameters are declared; the schema's maximum/default limit is 10000, but that large default is unnecessary here. Retain only event time, entry references and result needed for the investigation; omit credential details, phone numbers and other personal data. An empty response does not prove the prior action did not happen.
3. Have IFSS map any returned reference to the intended physical door, its zone/owner organization and this user's actual direct/group permissions. A mismatch between reported controller/history references and empty current entries is evidence to reconcile, not an unlock target to force into the app.

The existing local diagnostic now has a mode for these two reads, following fresh EU login and profile validation:

```bash
python /home/mbeka02/Desktop/ifss_challenge/latch_mobile/scripts/check-alta-access.py \
  --alternative-discovery-only \
  --output /tmp/latch-alta-alternative-discovery-2026-11-17.json
```

Run it interactively and enter account inputs only at its local prompts. It refuses to overwrite an existing report. This mode pages own-user controllers, reads at most 20 recent own-user events, sanitizes the report, and sends no unlock or configuration mutation. Offline HTTP-boundary verification checked documented nested controller references, pagination, bounded activity responses, data omission, empty results and explicit denials.

### Observed result

The user ran this mode at **2026-11-17 08:49 UTC / 11:49 Nairobi**. Login returned 201 and profile returned 200. Both the own-user controller list (`/acus?limit=100&offset=0&sort=name&order=asc`) and activity report (`/reports/activity?limit=20&offset=0&sort=time&order=desc`) returned **200**, `data:[]`, `totalCount:0`, and `filteredCount:0`. There was no denial or malformed response. Controller pagination completed with zero items; the bounded activity read returned no historical entry references. Thus these two reads supplied no COE identifier for this account. They do not explain the earlier Video unlock, establish account deletion, or resolve current Video authorization. No unlock was attempted.

Review coverage is targeted: the reference navigation and relevant discovery/assignment/credential/command schemas were inspected. This is not a claim that every operation in the public API was reviewed in depth or tested against the tenant. Organization hardware and group routes require broader scopes than the observed own-user token; documented scope exclusions must not be mistaken for observed empty inventories.

Current entry eligibility, shadow completeness/freshness, cross-organization inclusion, and attribution of historical intercom actions remain unverified. No inspected contract says possession of a mobile credential is required for the user entries read, and no undocumented query or ID substitution is justified by the reported empty list.

## Follow-up: omitted credential associations and mobile API surface

**The original raw `entries:[]` response predates the current diagnostic filters.** Sanitizing later reports cannot explain that original provider result. A narrower evidence gap does exist: the credential sanitizer retains IDs/type/dates but discards the optional nested `user`. The saved credential summary therefore cannot establish whether routing associations were absent from the provider response or simply omitted locally.

Fresh reinspection of `describeCredential` confirms one bounded read that could add information using the same account: `GET /orgs/{orgId}/users/{userId}/credentials/{knownOuterCredentialId}`. It accepts own-user read scope, returns `data:UserCredential`, and declares **only the three path parameters, no `options` query parameter**. The optional nesting is:

```text
data.user.groups[]
  id, name?
  opvideoIntercomProfiles[]?
    id, name?, opvideoIntercomProfileTypeId?
    opvideoIntercoms[]?
      id, name?
```

Every listed association/expansion beyond the present object's required ID is optional; no `withGroups` or other invented expansion should be added. First inspect any existing unsanitized response in memory, if still available. Otherwise a single detail read of the **already discovered own Cloud Key** is justified as a new-information probe, not another full diagnostic run. Retain presence-versus-empty flags and only credential/user/group/profile/intercom IDs and names, checking that returned credential/user IDs match the request. Never retain provisioning, PIN, card or certificate material. If `user` or `groups` is missing, report “not returned”; do not infer “no intercom association.” Even populated intercom/profile IDs are not entry IDs or proof of an unlock grant. [Credential detail schema](https://openpath.readme.io/reference/describecredential)

The official mobile SDK is a separate supported surface: it provisions a valid user's **mobile credential**, then obtains entries and manages BLE/Wi-Fi/LTE communication with readers/controllers. Its documentation and sample apps are distributed with the SDK; the public overview directs integrators to their account manager for access. The public FAQ describes nearby-reader detection and account switching, but supplies no REST endpoint, callable method signature or intercom-unlock discovery contract. This establishes a real SDK path; it does not establish that a Cloud-Key-only REST session can use it, nor that missing a mobile credential causes the public user-entry list to be empty. [SDK overview](https://openpath.readme.io/docs/mobile-sdk), [SDK FAQ](https://openpath.readme.io/docs/sdk-faqs)

The public data-access guide also documents MQTT status updates and mentions `GET /orgs/{orgId}/mqttCredentials?options=withShadows`, explicitly calling it an internal-support endpoint outside the API reference. Its scope requirements are not specified there and its output includes temporary broker credentials. It is not an established ordinary-token discovery fallback. No primary source found in this focused search documents a Quark/OPAL permissions endpoint that should replace user entries. [Data-access guide](https://openpath.readme.io/docs/getting-data-from-openpath), [MQTT guide](https://openpath.readme.io/docs/real-time-events-via-mqtt)

Finally, `OrgUser.opal` is only typed as a string in the inspected schema; it provides no public parsing grammar or target-ownership lookup contract. Its exact value can be compared with an already returned login user value, but should not be decoded into a guessed endpoint or treated as proof of the door's owner organization. The official model allows zones owned by another organization to be shared into the user's organization. The returned group name likewise cannot establish routing-only behavior. [Credential/profile schema](https://openpath.readme.io/reference/describecredential), [organization and shared-zone model](https://openpath.readme.io/docs/key-concepts)

This follow-up authorizes no tenant request by itself and does not ask another person to run diagnostics. It identifies the credential-association projection as the remaining concrete own-account evidence gap. No application changes or tenant calls were made during this research.

The own-account check is now implemented as `python3 scripts/check-alta-access.py --credential-associations-only --output /tmp/latch-alta-credential-associations-2026-11-17.json`. It obtains current credential IDs from the own-user inventory and reads one detail only when there is exactly one unambiguous Cloud Key. Both list and detail projections now retain optional user/group/profile/intercom identity fields and explicit presence flags while omitting credential secrets and contact details. HTTP-boundary verification passed for the documented nested shape, outer credential ID addressing, missing versus empty groups, and secret/contact omission. The user explicitly rejected asking Mohamed to execute scripts; this mode is for the applicant's own local investigation, with no APK build or application-runtime change.

At **2026-11-17 10:39 UTC / 13:39 Nairobi**, the user ran this mode. Login returned 201; profile, credential pages and the single Cloud Key detail returned 200. The detail matched the requested outer credential ID and retained the same November 15–29 validity interval. Both the list row and detail recorded **`userAssociationPresent:false`**: the API omitted the optional nested `user` object before projection, so this run exposed no group/profile/intercom association. This is an omitted expansion, not a returned empty group assignment. The diagnostic-projection hypothesis supplied no missing target mapping and does not explain the empty personal-entry response or Mohamed's APK result. No unlock was sent; the root cause remains unresolved.

## Wireless inventory comparison

The user identified three further organization inventory reads: `GET /orgs/{orgId}/wirelessLocks`, `/wirelessLockGateways`, and `/wirelessGateways`. Fresh inspection of their official schemas confirms broader organization/hardware/dashboard scopes, with no own-user scope alternative. This predicts a possible 403; it is not a recorded tenant response. `WirelessLock.entry` can contain an entry ID/name and zone/site, so a successful read could identify the target hardware mapping. Gateway inventory describes connecting hardware and does not itself establish personal entry access. [Locks](https://openpath.readme.io/reference/listwirelesslocks), [lock gateways](https://openpath.readme.io/reference/listwirelesslockgateways), [gateways](https://openpath.readme.io/reference/listwirelessgateways)

Use one fresh EU login/profile validation and test all three routes together:

```sh
cd /home/mbeka02/Desktop/ifss_challenge/latch_mobile
python3 scripts/check-alta-access.py --wireless-only --output /tmp/latch-alta-wireless-2026-11-17.json
```

The three inventory reads run in parallel with separate connections and per-resource reports. Each resource is paged with `limit=100`, increasing offset, `sort=name&order=asc`, bounded to six pages. Reaching the bound is recorded as incomplete, not an empty or complete inventory. Organizations are deduplicated across own-user associations. A denial or network failure on one resource does not suppress the other reads; there are no retries, redirects, unlocks, or configuration changes. Hardware rows retain inventory fields and entry references but omit authentication keys, configuration, serial numbers and location details. Full structured API errors remain visible with the common secret redaction. Reports are new local files with mode `0600`.

Offline HTTP-boundary checks passed for all three explicit denials, documented nested lock/entry mapping, pagination, deduplication, secret omission, an empty resource, and an independent timeout. These checks establish diagnostic behavior only. No app runtime change or build was made.

The user ran the wireless comparison at **2026-11-17 09:56 UTC / 12:56 Nairobi**. Login returned 201, own profile 200, and **all three wireless inventory routes returned 403 / H-4000**. Each response explicitly named the unavailable listing permission and supplied broader accepted scopes. Thus the token cannot inspect these organization hardware inventories; no lock-to-entry mapping was obtained. These are denied reads, not successful empty inventories, and do not establish whether COE is wireless or whether the user can unlock it through a separately authorized path.

At the user's request, `--wireless-only` now also reads **organization entries** (`GET /orgs/{orgId}/entries`) in the same run, with the same pagination bound and documented name sort. All four resources run independently in parallel after one login/profile check. Entry output retains IDs/names and zone/site names. Use a new report filename, for example `/tmp/latch-alta-wireless-entries-2026-11-17.json`. Offline verification confirmed entry pagination and data minimization while the three other routes return independent denials. This addition is an organization inventory read, distinct from the app's own-user `/users/{userId}/entries` route.
