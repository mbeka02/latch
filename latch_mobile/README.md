# Latch

Android-first Expo / React Native app for the IFSS assessment. Phase 5 implements the direct Openpath adapter and isolated Android transport. **Phase 6 uses EAS to build a signed live preview APK.** Default local demo mode makes no Alta requests and operates no physical door. Device and IFSS tenant verification remain separate acceptance checks; no backend is required.

## App branding and launch

The Latch icon uses a rounded white **L**, red diagonal capsules/dots and an orange accent inspired by the IFSS logo. The editable artwork and palette live in `src/constants/branding.ts`; generated PNG/SVG assets live in `assets/branding/`. The opaque launcher icon is 1024 × 1024; Android has separate transparent foreground and monochrome layers with padding for adaptive masks. The starter blue splash and Expo icon overrides have been replaced in app configuration.

Launch uses a static native mark on `#111111`, handed over on layout to the same vector at the same 200 dp size. A 240 ms wordmark reveal and brief fade finish within 700 ms; Reanimated CSS animations run on the UI runtime. It plays once per root mount, never on sign-in or foregrounding. Reduced motion skips the animated overlay. Session restoration runs concurrently; the animation never waits for an API response, and the existing restoration/recovery screen remains responsible for access readiness.

Regenerate assets with `node scripts/generate-brand-assets.mjs` using Node 24+, `/usr/bin/python3`, PyGObject, librsvg and Cairo. These are artwork tools only; no app dependency was added. Do not edit generated PNGs separately from the vector source.

The launcher icon, app label and native splash require a new APK. Expo Go cannot verify their packaged appearance. Router tests cover startup dismissal, reduced-motion journeys and foregrounding; the native-to-React handoff, Android launcher masks and animation smoothness still need a preview/release APK check on a phone. See [Expo's splash guidance](https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/).

Starter logos, badges, tab illustrations, animation components and the project-reset script have been removed. The generated `/_sitemap` route is disabled. Invalid links and caught screen errors use Latch guidance and recovery controls; raw error details are not displayed. Caught errors still pass through Sentry's privacy policy. The evaluator APK must be a standalone release build: Expo Go and development builds retain host/developer UI that is not part of Latch's release interface. Release packaging and device checks remain phase 6 work.

Access screens hide the navigation title bars and apply explicit safe-area padding. The sign-in title lives in the form, beneath the standalone Latch mark, with the general label **Building access**. Space Grotesk is bundled locally in Regular, Medium and Bold for text, fields, modals, splash lettering and notifications; its license and provenance are in `assets/fonts/`. Demo credentials and MFA examples appear below the form only in demo mode; live mode shows a concise Alta prompt and the SSO limitation. A local architectural line pattern references IFSS's building imagery and appears on sign-in only. Its slow, decorative movement runs only while the sign-in screen is focused and the app is active; reduced motion keeps it static. Other screens have a plain background. Both themes share the form spacing, control radius and brand palette. See [the design notes and verification limits](docs/design/sign-in-review.md).

## EAS live preview (phase 6)

The `preview` profile builds a signed release APK for direct installation. It explicitly selects **live** mode, uses `com.mbeka02.latch`, disables Android backup, and requires neither Metro nor a development client. It retains individual Alta authentication and COE-only discovery. No store submission or backend setup is required.

```sh
npx eas-cli@latest build --platform android --profile preview
```

The first build completed successfully: **[download Latch 1.0.0 (2), live APK](https://expo.dev/artifacts/eas/j_rbB_uEFR9av5b5docxYQpMfo8CDNWsvjQlkf25eDI.apk)** or open [its EAS build page](https://expo.dev/accounts/mbeka02/projects/latch/builds/fa6ab713-730e-40e5-b92e-c7fbe71da71f). See [the phase 6 handoff](docs/phase-6-handoff.md) for signature/manifest evidence, install/device checks and IFSS acceptance steps. Build numbers and signing are managed by EAS. The public Sentry DSN is configured in the EAS preview environment; source-map upload failed because the build auth token is absent, and real-event verification remains pending.

Use supported real Alta credentials only in the live candidate; the fictional accounts below belong to demo mode. A build passing compilation does not establish IFSS account compatibility or physical door operation.

## Try the demo

Install the locked dependencies with `npm ci`, then run `npm start` and open the project in a compatible Expo Go installation or Android emulator.

Use these fictional accounts with password **`latch-demo-only`**:

| Email | Demo behaviour |
| --- | --- |
| `demo@latch.example` | Successful native-password sign-in |
| `mfa@latch.example` | Requires the fictional authenticator code `123456`; any other six-digit code is rejected |
| `sso@latch.example` | Explains that this authentication method is unsupported |
| `offline@latch.example` | Reports provider unavailability without granting access |
| `multi@latch.example` | Choose IFSS demo or Engineering demo; Engineering has distinguishable North/South COE doors |
| `missing@latch.example` | Signs in, but its entries contain no exact COE Door match |
| `ambiguous@latch.example` | Signs in, but duplicate COE entries have indistinguishable site/zone context |
| `no-key@latch.example` | Signs in with a mobile credential but no usable Cloud Key |
| `denied@latch.example` | Signs in, but the provider denies entry discovery |
| `unlock-denied@latch.example` | Discovery works; the simulated unlock is explicitly denied |
| `uncertain@latch.example` | Records a simulated command, then loses its response; acknowledgement is required |
| `timeout@latch.example` | Records a simulated command and never answers; the 15-second deadline restores an unknown result |

For MFA, the first attempt reveals the code field. Re-enter the password with the code. Passwords and codes are cleared after each submission and on **Cancel sign-in**. Changing the email resets the MFA form. The fixed demo code is not a real TOTP validator, seed or challenge-token protocol.

The password starts hidden. Tap the eye icon to show or hide it; the entered value is preserved. The toggle is labelled **Show password** / **Hide password** for accessibility and is disabled during sign-in.

Sign in to discover **COE Door** under the persistent demo-mode label. Tap **Unlock** beside the door (announced as **Unlock COE Door**), then choose **Cancel** or **Unlock** in the themed confirmation modal. Confirmation shows **Simulated unlock accepted. No physical door was operated.** Tap **Account** beside the logo to view the signed-in email and sign-out action in the animated **Your account** dialog. Choose **Sign out** inside that dialog to end the session, or **Cancel** to keep using the door screen. Opening or cancelling Account sends no unlock request.

The door screen uses compact icon-led rows on a plain background. Door name and full organisation/site/zone context sit beside a small decorative icon; the selected door has an adjacent **Unlock** action and a short readiness line. The action can wrap below the identity on narrow screens or with large text. Multiple matches use the same identity layout in a grouped picker with separators and chevrons. Icons do not track physical door position. Pending/cooldown/acknowledgement states still gate unlocking, and request outcomes remain visible in **Latest request**. There is no drawer or extra account route. See [door design notes](docs/design/door-review.md).

With `multi@latch.example`, choose **Engineering demo**, then **COE Door · South building · COE**. The unlock confirmation shows that organisation, site and zone. **Change door** returns to the candidate list; **Change organisation** clears the previous door selection. Unresolved attempt feedback remains visible with its original context. A single organisation/door proceeds automatically. Discovery never sends an unlock.

To try phase 4, confirm an unlock as `uncertain@latch.example`. Dismiss the toast or refresh: the unknown result remains and Unlock stays disabled. Background/reopen or restart the app to recover the same result. **Acknowledge result** saves acknowledgement without sending anything. Once the three-second cooldown ends, another attempt still requires opening and confirming the modal. This account deliberately loses every response; use `demo@latch.example` for accepted results, `unlock-denied@latch.example` for denial, or `timeout@latch.example` to exercise the pending state and deadline.

Pull down on the door screen to refresh COE access. The themed native refresh indicator runs while existing door content stays visible; Unlock and context changes are disabled until the check finishes. A still-available selected door stays selected using its newly discovered choice. Refresh also works in the multiple-COE-door picker, and overlapping pulls are ignored. It is blocked during confirmation, sign-out, acknowledgement saving and pending unlocks. Refresh never sends an unlock or clears an unresolved result.

Unavailable access keeps its reason on screen and offers **Try again**, pull-to-refresh and sign-out through **Account**. Retry repeats discovery only; after access is restored, unlocking still requires a fresh confirmation. Fix missing permissions, credentials or ambiguous names in the provider's configuration; refreshing cannot create access. Discovery remains limited to the assessment's **COE Door** target.

[Sonner Native](https://sonner-native.netlify.app/) relays sign-in errors, unavailable access, accepted unlock requests and unconfirmed results. Notifications match the system light/dark theme, disappear after five seconds, and can be tapped or swiped away. The full-width positioning wrapper keeps them horizontally centered; their card width is capped to the window's safe area and 480 dp. Error guidance and door outcomes remain on screen after dismissal. Signing in or out clears previous session notifications. Notifications never dispatch or retry an unlock.

Use fictional credentials in the default demo build. Its in-process mock cannot validate real Alta accounts.

## Direct Alta mode (phase 5)

Build configuration selects `EXPO_PUBLIC_LATCH_MODE=demo` (default when omitted) or `EXPO_PUBLIC_LATCH_MODE=live`. There is no in-app environment switch and no fallback after a live error. An invalid mode stops initialization. `EXPO_PUBLIC_ALTA_NAMESPACE` optionally supplies a confirmed namespace nickname; omit it when unnecessary. These are public build settings, never credentials. The host is fixed in native code to `https://api.openpath.com/`; there is no configurable API URL, shared key or evaluator-entered entry ID.

Live mode requires an Android build containing the local Expo module. **Expo Go, web and iOS do not provide that client**: requests fail closed rather than using generic fetch or demo data. The phase 6 EAS build compiles and packages the bridge; phone/runtime and IFSS acceptance checks remain pending. Evaluators need the resulting APK and their supported Alta account, not these developer settings.

The live form offers **Use authenticator code** before the first attempt. Enter a current six-digit TOTP if the account requires it; re-enter the password/code after a rejection. The documented API supports the submitted TOTP field, but its public schemas do not establish specific MFA-required, invalid-code or SSO error names. Live login errors therefore stay generic; the demo's automatic MFA challenge remains simulated. SSO-only sign-in is explicitly unsupported. `forMobileLogin` is omitted because its semantics are undocumented; a tenant requirement for it must be resolved with supported evidence.

The adapter uses native email/password login, the employee's raw JWT authorization header, current user/profile reads, user-scoped entries, existing paged credentials, and Cloud Key unlock. It identifies Cloud Keys by the returned `cloudKey` variant and sends the outer credential ID. Entries must carry readable site/zone context and a count consistent with all returned entries; missing/inconsistent context blocks selection. The entries schema declares no pagination inputs, so the app does not invent them. Credentials continue until an empty page, with inconsistent supplied counts rejected.

Login-derived org/user IDs are saved only as lookup hints. Restoration checks each against the current header-authenticated user/profile response and matching identity, recovers current org names, and preserves the original local expiry cap. It neither decodes JWT claims nor calls a token-in-URL endpoint or rotating refresh endpoint. Missing hints require fresh sign-in; new memberships require fresh sign-in to enter the saved hint set. A denied or malformed association blocks restoration. Saved IDs grant no authority; every discovery/preflight/unlock remains subject to Alta's current permissions.

Live confirmation explains that it requests a real unlock. Accepted feedback says **Unlock request accepted. Door position has not been confirmed.** Unauthorized responses, lost replies and session expiry use the same safe lifecycle/recovery rules as the demo. Local sign-out is available after an uncertain result without discarding its journal.

See [official API contract evidence](docs/openpath-contract-evidence.md) and [Android transport evidence and remaining checks](docs/android-transport-evidence.md). These distinguish documented facts, app policies, fixture results and unverified tenant/device behavior.

## Sentry monitoring (before phase 6)

The Sentry SDK, approved `mbeka02/latch-mobile` project, public local DSN, error privacy policy, navigation/API tracing and structured outcome logs are configured. Traces use 100% sampling in development and 10% in production. Request bodies/headers, employee details and arbitrary error/log context are excluded from JavaScript telemetry; replay and screenshot capture are off. Monitoring failures cannot repeat or change an unlock.

**Real-app receipt and native/release runtime verification remain pending.** The Sentry-enabled release APK compiles, but no test issue has been claimed as received, and no emulator or app dev server was started. See [monitoring configuration, phone verification and production gates](docs/sentry-monitoring.md). Source-map upload failed without a build-only auth token in the EAS environment; that token must never be an APK/public environment variable.

## Implementation

- **S1 — Authentication/session:** real Latch logic owns safe credential/MFA errors, expiry, restoration and account isolation. Screens subscribe to identity/status metadata and never receive tokens. Sign-out immediately clears the in-memory session and discovered selection, then removes the saved token.
- **S2 — Door access:** real Latch logic resolves organisation associations, COE candidates and a currently valid existing Cloud Key, then owns the unlock lifecycle, recovery journal and acknowledgement gate. Screens subscribe to readable attempt state and receive session-bound selection references rather than tokens or provider IDs.
- **S3 — Openpath adapter:** typed provider operations have explicit in-process and live implementations. The live implementation normalizes documented provider JSON and uses a narrow Android-only transport. `checkSession` uses current user/profile reads with saved association hints, not JWT decoding or token refresh. Tests replace the HTTP/native boundary while retaining the real adapter and Latch rules.
- **S4 — User journey:** the actual Router screens use those modules. A protected stack replaces the starter Home/Explore tabs. The demo label stays visible on sign-in and door screens.

Resolved organisation/entry/credential IDs stay in provider data and private Latch state. The recovery journal records the originating account, organisation/user and entry context. Tests change entry/credential IDs to verify that the Latch rules use discovery rather than app configuration. The mock adapter's request history records simulated commands for tests and contains no provider token.

## Discovery and access decisions

The COE filter uses trimmed, case-insensitive exact matching for **COE Door** and preserves the provider's original display name. Unrelated entries and similarly named annexes are never fallback choices. Several matches require distinguishable site/zone context and an explicit choice. Indistinguishable entries, or missing/duplicate organisation names, stop with IFSS guidance.

Credential pages are read to completion before deciding. The normalized adapter contract exposes `items` and `nextOffset`, with epoch-millisecond validity bounds (`null` means unbounded). Only a Cloud Key whose start is reached and end has not been reached qualifies. Missing, future-dated, expired, malformed or multiple usable keys block readiness. Discovery does not provision credentials or arbitrarily pick the first key. Non-advancing pagination and more than 100 pages fail safely. The demo uses two items per page; the live adapter requests 100 per page and continues until an empty response.

Before dispatch, Latch rereads permitted entries and all credential pages using the selected organisation/user context. The chosen entry's identity and displayed context must still match, and the same Cloud Key must remain the single usable key. A changed entry/key invalidates readiness and requires refreshed access and confirmation. New discovery, organisation selection, account replacement and logout invalidate old door references; late discovery cannot overwrite a newer result. These local checks do not grant Remote Unlock permission: the provider's current authorization remains decisive.

The reusable `AppModal` accepts a title, body, actions and close callback. It uses a native modal window with a themed, rounded card and scrim, a 220 ms opacity/scale entrance and 160 ms exit on Reanimated's UI runtime. Reduced motion removes scaling. Content scrolls within safe-area bounds at large font sizes. Cancel, Android Back and tapping the backdrop dismiss without unlocking. Journey tests render the actual modal content; the native Back callback is exercised through the native modal interface.

The clipped-toast screenshot traced to the tap-to-dismiss wrapper being centered without an explicit width around Sonner's absolutely positioned toast. The wrapper now stretches across the host, and the card has an explicit viewport-bounded width. Jest does not measure native Yoga geometry, so this fix and the modal's appearance/animation still need device visual verification.

## Session behaviour

The native composition uses [Expo SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/) with separate demo/live storage keys. The session record saves only the token, identity reference, org/user lookup hints, environment/version and original session timestamps. The separate recovery journal described below contains attempt metadata. Passwords, codes, cached permissions and reusable door selection references are never saved. Android backup exclusion uses SecureStore's config plugin; actual Keystore and packaged backup behaviour still require device/build verification. SecureStore has no web implementation in this app; demo supports compatible Android/Expo Go, while live requires the custom native build.

A **15-minute local cap** is an app policy, not an Alta requirement. Earlier reported provider expiry wins. Restart and foreground validation preserve the original deadline; there is no automatic refresh. Startup shows **Checking secure session…** until a current provider check completes. Discovery then reads current entry/credential data again. An outage never grants access from cached data; **Retry session check** deliberately rechecks, without sending an unlock.

Expiry, definitive token rejection, sign-out and account replacement invalidate door choices. Delayed login, restoration, discovery and unlock responses are bound to their originating app session. Native storage operations are serialized within that app instance, so a delayed write cannot undo a later logout. The UI suppresses notifications from a door screen that has already lost its session.

Storage read/write/delete failures block authentication with recovery guidance. If deletion fails, logout attempts to overwrite the stored token with an unusable value; recovery clears it before fresh sign-in. If both native mutations fail, physical token erasure cannot be guaranteed. Local sign-out does not claim vendor-wide token revocation.

## Unlock lifecycle and recovery

The module permits one active attempt per app instance, including access rechecks and storage preparation. Repeated taps are blocked in both the screens and the module. A **15-second local deadline** bounds the attempt; a **three-second local cooldown** follows a result. These values are app policy, not Alta requirements or relock indicators. Restoring an unresolved attempt starts a fresh three-second cooldown, which acknowledgement preserves across another restart.

The app distinguishes these outcomes:

| Outcome | Meaning and next action |
| --- | --- |
| Accepted | Provider acknowledgement and a saved local resolution; the app makes no claim about physical door position |
| Denied | An explicit provider rejection, shown separately from uncertainty |
| Not sent | Preflight, storage preparation or interruption prevented dispatch; recover access and deliberately confirm a new attempt |
| Unknown | A dispatched request lost its response, hit its deadline, was interrupted, or could not save its resolution; check the door and save acknowledgement before attempting again |

Before dispatch, the module must successfully save an unresolved marker to `latch.<environment>.attempts.v1`. It contains the originating identity/session timestamp, organisation/user/entry context, readable door context and timestamps. It contains no password, MFA code, token, credential secret or executable replay command. Missing storage cannot fall back to an in-memory unlock. Malformed, unreadable or wrong-environment journals block access with safe feedback. A failure to save the terminal resolution leaves uncertainty in place.

Unresolved history survives local logout, expiry and re-login for the same identity. Another identity sees none of its context and cannot acknowledge it; its own requests preserve that history. The journal retains unresolved records and prunes expired resolved records on later attempts. Its 100-record limit fails safely instead of discarding uncertainty. Session token deletion and recovery history use separate SecureStore keys.

Startup/foreground validation reads the journal and current identity before rediscovering access. Backgrounding, unmounting, account replacement and expiry interrupt local work. Before dispatch, an interrupted read/write cannot later turn into a queued command; after dispatch, uncertainty remains. Late results cannot settle a newer attempt, change another account's feedback or expire a session through an obsolete preflight error. Stopping local work cannot retract a command already sent. The direct HTTP transport never queues or retries a command; its native deadline/cancellation also cannot undo transmission.

Unknown feedback remains after toast dismissal, refresh and context selection. **Acknowledge result** only saves acknowledgement; it does not dispatch, resolve the physical outcome or bypass fresh access checks. A subsequent attempt requires the confirmation modal again. Reconnect, resume, sign-in and discovery never automatically retry, queue or replay an unlock. The guard applies to this app instance and does not provide vendor idempotency or coordination with other devices.

## Checks and TDD evidence

From this directory:

```sh
npm test
npm run lint
npm run typecheck
```

`npm test` runs once using the Android `jest-expo` preset. Tests stay outside `src/app/`, use the real Latch modules, and replace only the external provider/native interfaces. No snapshots or live tenant operations are involved.

Phase 0 established the runner by observing the missing demo-label failure, then passing the minimal launch test. Phase 1 added each behaviour through a separate red → green cycle:

| Seam | Observed red | Green behaviour |
| --- | --- | --- |
| S1 | Sign-in not implemented | Dummy identity can sign in and read identity metadata without its token |
| S2 | Discovery returned no choices | COE and existing Cloud Key resolve from returned data with changed IDs |
| S2 | Unlock not implemented | An explicit request uses the discovered entry and credential |
| S1 | Session remained after sign-out | Sign-out clears the public session |
| S4 | Email field absent | User signs in to the discovered door and signs out through the protected stack |
| S4 | No native confirmation opened | Cancel leaves the provider request history empty |
| S4 | Confirmation had no Unlock action | Confirm dispatches one simulated command and displays truthful acceptance |
| S4 | No Show password control | Eye toggle shows/hides the password while preserving its value |
| S4 | Sign-in error had no notification; stale error survived recovery | Error toast accompanies persistent guidance and clears when sign-in succeeds |
| S4 | Accepted unlock had no toast or accessible dismissal | Acceptance toast dismisses on tap while the door result remains visible |
| S4 | Failed unlock had no warning toast | Unconfirmed-result warning dismisses without removing the persistent outcome |
| S4 | Unavailable access had no error toast | Error toast accompanies persistent unavailable state with no unlock action |

Phase 2 continued at S1 and selected S4 journeys, one missing behaviour at a time:

| Seam | Observed red | Green behaviour |
| --- | --- | --- |
| S1 | Rejected replacement login retained the old identity | Rejected sign-in leaves no usable session |
| S1 | MFA errors were generic or always required another code | Required/invalid MFA outcomes and successful code recovery remain distinct |
| S1 | SSO/provider errors were generic or exposed raw details | Unsupported method and safe unavailable outcomes |
| S1 | Old door choices unlocked after the local cap | Local/upstream expiry blocks the operation |
| S1 | Restoration was absent | Fresh instance checks the saved token and preserves its original cap |
| S1 | Storage failures exposed raw errors; logout survived restart | Safe failures and durable removal of the saved session |
| S1 | Corrupt records/identity mismatch were accepted or mishandled | Invalid records and a different provider identity cannot restore access |
| S1 | Outage errors were raw | Access stays blocked with deliberate retry available |
| S1/S2 | Late login, restore, discovery or native write replaced later state | Session changes reject stale results and serialize storage mutations |
| S1 | Expired saved tokens or provider rejection retained authority | Expired/rejected sessions lose active and stored authority |
| S1 | Failed logout deletion could restore the old account | Cleanup recovery and an unusable overwrite protect the saved session |
| S1 | Non-finite provider expiry granted an unbounded session | Malformed expiry fails safely |
| S4 | No MFA input or expiry navigation | Invalid-code recovery and expired-session replacement work through real screens |
| S4 | Cancel left obsolete feedback; late unlock showed a toast after expiry | Cancellation clears secrets/feedback and old outcomes stay out of the signed-out screen |

Additional journey checks exercise restart through the real SecureStore adapter with mocked native functions, verify passwords/codes are absent from its saved value, hold a provider check pending to verify the loading gate, and recover from a startup service outage without operating a door.

Phase 3 continued through S2 and S4:

| Seam | Observed red | Green behaviour |
| --- | --- | --- |
| S2 | Missing COE returned a generic error | Safe missing-entry outcome; unrelated entries cannot unlock |
| S2 | Multiple memberships were rejected generically | Readable organisation choices and selected user/organisation authority |
| S2 | Distinct COE matches were rejected; indistinguishable matches became choices | Contextual door choices and explicit ambiguity blocking |
| S2 | An expired key enabled discovery | Only one currently valid Cloud Key enables readiness |
| S2 | Paged credentials were unsupported | Complete pagination before deciding, including keys on later pages |
| S2 | A removed entry still dispatched | Current entry and credential checks before dispatch |
| S2 | Older discovery returned usable choices | New discovery invalidates earlier results and selections |
| S2 | Duplicate organisation names could be selected | Ambiguous membership names require clarification |
| S4 | Multi-organisation and missing-key demo accounts could not reach the required states | Contextual selection, persistent reasons, deliberate refresh and modal-confirmed sign-out |

Regression checks also cover future/missing/mobile/ambiguous keys, later-page denial, non-advancing pages, credential expiry/replacement before dispatch, previous-account references, organisation changes and recovery from denied reads. They use the real Latch modules and replace only the external provider/clock/native boundaries.

Phase 4 continued through S2 and S4, substituting only the external provider, storage and clock:

| Seam | Observed red | Green behaviour |
| --- | --- | --- |
| S2 | A lost response threw a generic error; explicit denial became uncertainty | Accepted, denied and unknown results remain distinct; rediscovery never replays a command |
| S2 | Concurrent requests dispatched twice; another immediate request succeeded | One pending attempt and a three-second cooldown enforced by the module |
| S2 | Unlock dispatched despite a failed pending write | Durable marker required before dispatch |
| S2 | Restart forgot uncertainty; known acceptance restored as unresolved | Journal restores unknown state or the saved cooldown appropriately |
| S2 | Acknowledgement was absent | Saved acknowledgement changes only the recovery gate |
| S2 | An unanswered command stayed pending indefinitely | Fifteen-second deadline, unknown result and ignored late reply |
| S2 | Background interruption was unsupported | Interruption preserves uncertainty and a late reply cannot settle a newer attempt |
| S2 | An obsolete preflight error expired the current session | Stopped attempts cannot change current session or result state |
| S2 | Restart bypassed the interrupted attempt's cooldown | Restored uncertainty and saved acknowledgement preserve a fresh cooldown |
| S4 | An unknown result was displayed as simulated acceptance | Warning toast, persistent context and explicit acknowledgement gate |
| S4 | New failure demo accounts could not reach their required states | Distinct denied, uncertain and timeout scenarios |

Further checks cover failed acknowledgement/resolution writes, missing storage, corrupt journals, late preflight/native writes, logout/re-login/account isolation and credential-secret exclusion. Journey tests exercise offline-before-dispatch, acknowledgement followed by fresh confirmation, actual SecureStore adapter calls with mocked native storage, AppState interruption, foreground checks and a fresh Router mount. The native restart test preserves uncertainty without issuing a second command.

Phase 5 continued primarily at S3, retaining real S1/S2 modules and selected S4 journeys:

| Seam | Observed red | Green behaviour |
| --- | --- | --- |
| S3 | No HTTP adapter | Documented native login and current profile normalize into a personal session |
| S3 | Incomplete/contradictory login data was accepted | Invalid identity, token, expiry and association data fail safely |
| S3 | TOTP/namespace fields were absent | Documented fields are sent without guessed mobile/SSO behavior |
| S3 | Status failures were ignored or inferred from body text | Safe status policies, with no provider detail or speculative MFA classification |
| S3/S1 | Restoration had no provider mapping or saved hints | Current profile reads restore the same identity and original expiry cap |
| S3 | Discovery/unlock operations were absent | Contextual entries, paged Cloud Keys, numeric entry IDs and empty `204` |
| S3 | Partial entries and contradictory credentials were usable | Incomplete/ambiguous protocol data blocks access |
| S3 | Stalled requests were unbounded | Fifteen-second deadline and no adapter retry |
| S3 native | Redirect handling was absent | Local HTTPS fixture receives credentials once; redirect destination receives none |
| S3 native | OkHttp replayed a `503 Retry-After: 0` unlock/read | One-shot POST bodies, disabled recovery and a one-exchange budget |
| S3 native | Responses/queued work were unrestricted | Known routes only, bounded response, cancellation and closed-client rejection |
| S3 native | Slow streaming exceeded OkHttp's configured deadline with Expo's Okio | Independent native cancellation timer bounds the call |
| S4 | Live journey showed demo-only labels and no proactive MFA input | Actual screens use explicit live wording/TOTP and truthful acceptance feedback |
| S4 | Live build without the module selected mock data | Explicit composition fails closed without native transport |
| S4 | Unknown-result gate prevented confirming local sign-out | Sign-out remains available while recovery history is retained |

**Phase 5 baseline:** 4 Jest suites, 134 tests passed, plus 10 native JVM transport tests. **After Sentry integration:** 7 Jest suites, 145 tests pass; lint and typecheck pass. Tests replace the external Sentry SDK and inspect the real outbound privacy callbacks; they do not send events. The JVM harness uses local HTTP/TLS fixtures; see its evidence note for dependencies and checks. Notification tests render actual Sonner. The live-mode Android production JavaScript/Hermes export also passed with Sentry source maps/debug IDs. Map upload was disabled. Neither the export nor autolinking is an APK/native compilation check.

## Evidence limits and next phases

Phase 5 used deterministic HTTP fixtures, local JVM HTTP/TLS fixtures and a terminating production export, without launching an emulator or app dev server. Device checks for recovery screens, actual process termination, native bridge registration, storage behavior and background timing remain manual. No APK build, live tenant test or physical unlock was performed. JavaScript journey tests do not establish native layout, keyboard, TalkBack or hardware behavior. Latch icons and splash assets now replace the starter branding; packaged appearance remains a device/release check.

Phase 5 completes the tenant-free direct adapter and native transport implementation/evidence. Phase 6 is next: native APK compilation/inspection, device verification and IFSS handoff. The [transport evidence note](docs/android-transport-evidence.md#evidence-boundaries--phase-6) records the remaining build/device gates. Real account/namespace compatibility, exact provider error behavior, permission enforcement and revocation propagation remain IFSS acceptance checks. A sent request cannot be undone by local expiry or interruption.

The detailed implementation plan remains in the workspace at `../implementation-plan.md`.
