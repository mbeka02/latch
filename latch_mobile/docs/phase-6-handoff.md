# Phase 6 — Android preview and IFSS handoff

Prepared 2026-11-16. The user selected a **live preview first**.

**Subsequent source-map setup:** EAS preview now has a dedicated build-only `SENTRY_AUTH_TOKEN` secret. The preview profile no longer allows Sentry upload failures. An older local Android Hermes export was uploaded and server processing verified; no replacement APK was built and no matching release stack was verified. See [monitoring evidence](sentry-monitoring.md#upload-authentication-configured--2026-11-16). The empty, untracked `latch_backend` folder was removed; Latch continues to call Alta directly.

## Latest profile-compatible preview — 1.0.0 (5)

EAS build [`9779f600-bba3-423a-a1ed-b68dfd71245e`](https://expo.dev/accounts/mbeka02/projects/latch/builds/9779f600-bba3-423a-a1ed-b68dfd71245e) **finished successfully** on 2026-11-16 at **19:28 Nairobi / 16:28 UTC**. [Download Latch 1.0.0 (5)](https://expo.dev/artifacts/eas/GFGhv_b3mtd6F43HoLwCZiXmiDJ3XhkR-59Wy9IQycY.apk).

- Source commit `d4f922689678f872063aeb521125a7c1c597eb9f` includes the profile fix `d75a705`: optional `identity.users` can be absent when namespace organisation, login organisation, profile user and identity match exactly. Contradictory explicit associations still fail closed. Response-validation failures receive accurate guidance rather than a connection-outage message.
- APK size **113,127,663 bytes**; SHA-256 `aa86701ebd3227f7b5514f12d0e2e685eed777177cad49228f0fde33639c88e3`. Signature Scheme v2 verifies with the same certificate as previous previews. Package `com.mbeka02.latch`, version `1.0.0` / code `5`, non-debuggable, `allowBackup=false`.
- DEX contains the fixed EU origin and transport module, with the exact US origin absent. Hermes contains `org:ifss-group`, MFA UI, `invalid-response` classification/guidance and diagnostic field names. The build's source commit and packaging match the requested correction; phone behavior remains to be tested.
- **169 JavaScript tests / seven suites**, lint and typecheck passed on the unchanged source before upload. Offline replay of the saved profile through the diagnostic validator passed. No real login/unlock request or app launch was made by the agent.
- Both cloud dependency-insight tasks succeeded with OkHttp `4.9.2` / Okio `3.16.0`. Sentry source-map upload still failed with **Auth token is required**, permitted by existing `SENTRY_ALLOW_FAILURE=true`. Receipt/readable stacks for release `com.mbeka02.latch@1.0.0+5` / dist `5` are unverified.

Install as an update and retry sign-in. Preview 4 authenticated successfully but rejected the profile shape; this APK contains that fix. Subsequent COE discovery, own Cloud Key and permission checks still require a live phone test. See [profile findings](openpath-contract-evidence.md#observed-eu-profile-and-parser-correction) and [artifact evidence](apk-profile-preview-evidence.json). Historical artifacts below retain their original limitations.

## Earlier EU and UX preview — 1.0.0 (4)

The user authorized a new live preview after merging the EU correction and UX refinements. EAS build [`1dbd4b5d-f010-426c-baa7-d553138897f7`](https://expo.dev/accounts/mbeka02/projects/latch/builds/1dbd4b5d-f010-426c-baa7-d553138897f7) **finished successfully** on 2026-11-16 at **17:52 Nairobi / 14:52 UTC**.

- [Download Latch 1.0.0 (4)](https://expo.dev/artifacts/eas/Bq8o85GYl5NzR7xN41fohmavs6gPlBSJK_HclMTBWik.apk). Source commit `9b84f428608eadc854f7183e29a489d89c9c77a8`, live `preview` profile, existing remote signing key.
- APK size **113,127,087 bytes**; SHA-256 `bfec5bab8e0973ec71d186a821f5d00ae48c947fac71d2163829c1db01a8a41d`.
- APK Signature Scheme v2 verifies; certificate SHA-256 `63d52504a294a420a493ba2ae6d85656970cebcbddf07e863819d9aaa9c3260a` matches previews 2/3. Package `com.mbeka02.latch`, version `1.0.0` / code `4`, non-debuggable, `allowBackup=false`.
- DEX contains the native transport and **`https://api.eu.openpath.com/`**, with the old exact US origin absent. Hermes contains **`org:ifss-group`**, the separate MFA step and safe diagnostic field names. This verifies packaging, not a real Android request or MFA response.
- **156 tests / seven suites**, lint and typecheck passed immediately before upload. No app was installed/launched and no real login or unlock request was made by the agent.

Install over the previous preview and sign in afresh: EU/namespace-scoped storage intentionally ignores legacy US sessions. The password/code, errors and loading flow changes are described in [UX notes](design/auth-feedback-review.md). Profile, COE discovery, own Cloud Key retrieval, live MFA and any supervised physical unlock still require phone/IFSS acceptance. Cloud logs confirm the dependency-insight tasks resolve OkHttp `4.9.2` and Okio `3.16.0`. Sentry source-map upload again failed with **Auth token is required**; the existing `SENTRY_ALLOW_FAILURE=true` allowed completion. Runtime receipt and readable stacks for release `com.mbeka02.latch@1.0.0+4` / dist `4` remain unverified. See [artifact evidence](apk-eu-preview-evidence.json). The older artifact sections below are historical.

## Earlier EU source correction — build initially held

The user subsequently verified **HTTP 201** from `https://api.eu.openpath.com/auth/login` with `namespaceNickname: org:ifss-group`, and requested applying the fix **without creating another build**. Current source now pins the native client to the EU host and supplies that exact namespace by default; the preview profile also explicitly includes it. Live session and attempt storage is partitioned by EU region and configured namespace, leaving legacy US records untouched and forcing fresh sign-in in the new context. No arbitrary-host selection, cross-region fallback, shared credentials or portal-discovery dependency was added.

At that stage, **155 JavaScript tests / seven suites**, lint, typecheck and **10 local JVM transport fixtures** passed. Two real Router regressions cover the configured live namespace request and refusal to hydrate a legacy US token. No APK, native app launch, emulator, dev server or EAS job was created during that initial source-only correction. The user subsequently approved the preview 4 build documented above. The older downloads below retain the US configuration and cannot acquire this native-origin correction through Metro.

The successful local probe establishes authentication only. Header-authenticated profile reads, COE discovery, own Cloud Key retrieval and supervised unlock/permission behavior still require testing in the corrected Android app.

## Latest diagnostics preview

The replacement live preview **1.0.0 (3)** finished successfully on 2026-11-16 and supplied the diagnostic evidence recorded below. It still uses the old US configuration; use a future corrected APK for the next sign-in check. Expo Go does not include the custom live transport. Metro is stopped.

- [Download the replacement APK](https://expo.dev/artifacts/eas/TSzvftu4AIHtISV0SsjCZ1lj20PkvYyUr-ie3Vfqpjc.apk) · [EAS build `a4a32b60-bf6b-4843-bc03-51397ca68e35`](https://expo.dev/accounts/mbeka02/projects/latch/builds/a4a32b60-bf6b-4843-bc03-51397ca68e35).
- Source commit `5825356`; diagnostics fix `83593a0`. APK size **113,122,631 bytes**; SHA-256 `d2d61839b730e147755a65751f0251831623f0314bee7912798c9ce5da3cf07a`.
- Signature verified and certificate matches the original APK. Package/version `com.mbeka02.latch` / `1.0.0` (`3`), non-debuggable and `allowBackup=false`. Packaged Hermes strings include the new diagnostic fields; DEX contains the native transport module name. The release dependency-insight tasks again resolve OkHttp `4.9.2` and Okio `3.16.0`.
- **153 tests / seven suites**, lint and typecheck passed. The user's retry verified new diagnostic delivery from release `com.mbeka02.latch@1.0.0+3`: HTTP 400 at the login response-status stage, duration 1597 ms. Sentry filtered the classification label. Successful authentication is not established. No new real Alta request or physical door operation was made by the agent.
- Sentry source-map upload still failed because the build token is absent. Task release/dist are `com.mbeka02.latch@1.0.0+3` / `3`; readable release stacks and native payload privacy remain unverified.

See [diagnostics artifact evidence](apk-diagnostics-evidence.json) and [sign-in investigation / Logs instructions](sentry-monitoring.md#investigating-sign-in-failures). The original preview's evidence and outstanding acceptance checklist are retained below; original artifact details refer to version code **2**.

**Regional follow-up:** the user's portal is European; official documentation identifies a separate EU API host. Earlier local probes omitted the region flag and used the US default, so the earlier claimed US/EU comparison is superseded. The user reports the result still does not change and supplies provider rejection `H-3120`; correlate the printed host with future probe output before treating a regional comparison as controlled. The probe now requires an explicit region. Monitoring improvements are retained, but this APK still pins the US API host. Application-level regional routing and a known-working IFSS account test remain necessary before treating EU evaluator compatibility as verified. See [regional findings](openpath-contract-evidence.md#regional-host-investigation--2026-11-16).

## Original preview delivery status

The `preview` profile produces an internally distributed, signed **release APK**. It is not an Expo Go/development-client build and does not require Metro, a Latch backend or an evaluator-managed deployment. It connects directly to Alta; it cannot fall back to demo accounts.

| Item | Value / evidence |
| --- | --- |
| EAS project | `@mbeka02/latch` — `a2756ebf-3842-4633-8f28-7837bc0137fe` |
| Profile / environment | `preview` / EAS `preview` |
| App / Android package | Latch / `com.mbeka02.latch` |
| App version | `1.0.0`; Android version code `2`, managed and incremented by EAS |
| Source configuration commit | `35619bc` |
| Signing | EAS-managed Android keystore; signing material is not in the repository |
| Alta host | Fixed native HTTPS origin `https://api.openpath.com/` |
| Target | Exact trimmed, case-insensitive `COE Door` matches in the authenticated user's selected organisation |
| Live build mode | Explicit `EXPO_PUBLIC_LATCH_MODE=live` |
| Backup | `android.allowBackup=false`; verify the final manifest below |
| Cloud build | [`fa6ab713-730e-40e5-b92e-c7fbe71da71f`](https://expo.dev/accounts/mbeka02/projects/latch/builds/fa6ab713-730e-40e5-b92e-c7fbe71da71f) — **finished successfully** on 2026-11-16 |
| Artifact | [Download the live APK](https://expo.dev/artifacts/eas/j_rbB_uEFR9av5b5docxYQpMfo8CDNWsvjQlkf25eDI.apk) — 113,121,487 bytes, universal four-architecture APK |
| APK SHA-256 | `2778c483566f8f1e452998cd5cc052e18e71110fdd52bb3ba01f11bdaf3b6e21` |
| Android compatibility | Minimum API 24; target API 36; compiled with API 37 |

This remains a **live candidate awaiting device and IFSS verification**. A successful build, API acceptance and a physically observed door operation are separate results.

Open the APK link on the Android phone, download it and open the file. If Android asks, allow that browser/file source to install the APK, then install and launch **Latch**. Neither an Expo account nor Expo Go/Metro is required. Keep this APK on the same EAS-managed signing identity for future in-place updates.

## Reproduce the build

Run from `latch_mobile` with the linked Expo account:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npx eas-cli@latest build --platform android --profile preview
```

`eas.json` requires a clean source commit and requests an APK with `developmentClient=false`, internal distribution, remote signing and automatic Android build-number increments. Node is pinned to `24.21.0`. The existing project ID and owner are preserved. There is no store submission or over-the-air update setup in this phase.

The repository-root `.easignore` excludes local environment files, signing keys, credentials files, dependency/build caches, agent tooling, tests and design captures. It preserves the app-owned Android transport source under `modules/latch-openpath-transport/android`. Inspect the upload locally with:

```sh
npx eas-cli@latest build:inspect --platform android --profile preview --stage archive --output /tmp/latch-preview-archive
```

The post-success hook prints the release runtime's resolved OkHttp and Okio dependency information in EAS logs. This build resolves **OkHttp 4.9.2** and **Okio/Okio JVM 3.16.0**, matching the fresh native fixture run. Both dependency-insight tasks completed successfully. The release Java/Kotlin transport and Expo bridge compiled successfully in the actual app build; their declared dependencies alone are not the evidence.

## Build environment and monitoring

The public Sentry ingest DSN is configured in the EAS preview environment; its value is not committed. The temporary verification flag is explicitly off. No Alta password, TOTP, administrator credential or shared unlock token belongs in build configuration.

No build-only `SENTRY_AUTH_TOKEN` was configured for this first preview. The cloud log confirms source-map upload failed with **Auth token is required**; `SENTRY_ALLOW_FAILURE=true` let the APK build complete. This does not disable runtime monitoring. The upload task used release `com.mbeka02.latch@1.0.0+2` and dist `2`, but readable symbolication and a real app event remain unverified. Add an appropriately scoped build token as an EAS **secret**, rebuild and verify a received release event before claiming complete production monitoring. Never reuse the onboarding handoff code as a build credential.

`EXPO_PUBLIC_ALTA_NAMESPACE` is optional and currently omitted. If IFSS confirms its intended accounts require a namespace nickname, configure that confirmed public value in the preview environment and rebuild. Do not guess another host or namespace after a sign-in failure.

## Automated and artifact evidence

- Seven JavaScript suites / **150 tests passed**, along with lint and TypeScript checks.
- A fresh run of **10 JVM transport fixture tests passed** on 2026-11-16 using the production Java transport, OkHttp `4.9.2` and Okio `3.16.0`. Requests used local test servers, not Alta. See [transport evidence](android-transport-evidence.md).
- The inspected local EAS archive contains the native Java transport and excludes `.env.local` and `node_modules`. Retained agent/design directories contain no files. Its source inputs are approximately 4.9 MB, including EAS's Git metadata.
- Cloud Expo Doctor reports 19/20 checks: the sole reported failure is the deliberate Sentry version override (`8.35.0` installed versus Expo's recommended `~8.28.0`), selected under the earlier requirement to use Sentry's current SDK. It is recorded rather than silently downgraded or treated as a clean Doctor pass; native compilation and device compatibility need their own evidence.
- Android Build Tools `35.0.0` **apksigner verifies the APK's v2 signature**: RSA 2048-bit key, certificate SHA-256 `63d52504a294a420a493ba2ae6d85656970cebcbddf07e863819d9aaa9c3260a`.
- `aapt` confirms **Latch**, package/version `com.mbeka02.latch` / `1.0.0` (`2`), non-debuggable release defaults, and **allowBackup=false**. SecureStore backup/extraction rule resources are present.
- ZIP/DEX inspection finds the Hermes bundle, native `LatchOpenpathTransport` module name and fixed `https://api.openpath.com/` origin. The Java/Kotlin release compile and autolinking logs establish packaging; R8 obfuscates original class names, and runtime registration still needs a phone check.
- No environment/signing credential files were found in the APK; a limited scan found no Sentry setup/build-token prefixes in its code. This is not a claim of a comprehensive secret audit. The actual release dependency graph matches the native fixture run.
- The manifest inventory includes internet/network state, vibration, legacy storage limited to API 32, overlay, SecureStore biometric/fingerprint permissions and the app's non-exported receiver permission. These template/module declarations are recorded in [APK evidence](apk-evidence.json); no new runtime permission-request flow was added. This first preview's manifest is not described as networking-only.
- No native app was launched, emulator started, real credentials submitted or physical door operated by the agent.

Full machine-readable results and verification limits are in [apk-evidence.json](apk-evidence.json). The APK was downloaded to `/tmp/latch-live-preview-1.0.0-2.apk` for inspection; the EAS link above is the distribution artifact.

## Phone checks before IFSS acceptance

Record device model, Android version, APK build ID/version, date and result for each check. Keep passwords, TOTP codes and tokens out of screenshots, logs and notes.

| Check | Expected result | Status |
| --- | --- | --- |
| Install and cold launch with Metro stopped | Latch icon/name/splash; sign-in is usable without a developer server | Pending |
| Live identity | Alta sign-in prompt; no demo banner, dummy credentials, verification control or environment switch | Pending |
| Themes and system UI | Readable light/dark screens, safe-area layout, keyboard and large text; no Expo/developer interface | Pending |
| Navigation and accessibility | Password toggle, MFA field, TalkBack labels/focus and Android Back work; modal actions remain reachable | Pending |
| Account and confirmation | Account reveals email; Cancel/Back preserves session; explicit Sign out ends it; cancelling unlock sends nothing | Pending |
| Pull-to-refresh | Works at the top of short and scrollable content; themed spinner completes; valid selected context remains | Pending |
| Discovery failure / offline | Clear guidance and Try again; no unlock from refresh, retry, reconnect or resume | Pending |
| Session and interruption | Expired sessions return to sign-in; interrupted attempts retain uncertainty without replay | Pending |
| Monitoring | Inspect a real received app event and native payload privacy; confirm release/dist and readable frames | Pending |

## IFSS acceptance using an approved account

IFSS retains its credentials and provisioning responsibilities. Once the native transport/privacy checks are accepted, an evaluator can use their supported Alta email/password account and a current authenticator code when required. SSO-only accounts are not supported by this build.

1. Confirm the intended account, API host and any required namespace. Verify that the user has a valid own Cloud Key and appropriate Remote Unlock/entry permissions.
2. Sign in on the phone. Where prompted, choose the organisation and distinguish COE candidates by their real site/zone. No numeric IDs or shared credential are entered.
3. Cancel an unlock confirmation and verify no operation occurs.
4. For one authorised, supervised physical test, confirm the exact door/context with an onsite observer, then deliberately choose Unlock. Record API acknowledgement separately from what the observer sees at the door.
5. Verify an appropriately configured denied account/permission case. Capture redacted results; permission provisioning or timing is an IFSS/vendor matter, not something Latch bypasses.
6. Check logout, expiry, refresh and reconnect do not replay an operation. An unknown result requires checking the door and acknowledging uncertainty before a fresh confirmed attempt.

Use the fictional scenarios in [the README](../../README.md#try-the-demo) only with a separately labelled demo build. Fictional credentials do not authenticate in this live APK.

## Completion boundary

Native compilation and static artifact inspection can be completed without tenant credentials. Installation, gestures, native storage/restart behaviour, real monitoring payloads and IFSS account/door acceptance remain pending until actually exercised and recorded. Do not mark phase 6 or the app IFSS-verified solely because EAS produces an APK.
