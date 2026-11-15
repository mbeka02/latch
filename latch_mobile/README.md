# Latch

Android-first Expo / React Native app for the IFSS assessment. **Phase 2 remains a simulated demonstration only.** It makes no Alta requests, operates no physical door and needs no backend.

## Try the demo

Install the locked dependencies with `npm ci`, then run `npm start` and open the project in a compatible Expo Go installation or Android emulator.

Use these fictional accounts with password **`latch-demo-only`**:

| Email | Demo behaviour |
| --- | --- |
| `demo@latch.example` | Successful native-password sign-in |
| `mfa@latch.example` | Requires the fictional authenticator code `123456`; any other six-digit code is rejected |
| `sso@latch.example` | Explains that this authentication method is unsupported |
| `offline@latch.example` | Reports provider unavailability without granting access |

For MFA, the first attempt reveals the code field. Re-enter the password with the code. Passwords and codes are cleared after each submission and on **Cancel sign-in**. Changing the email resets the MFA form. The fixed demo code is not a real TOTP validator, seed or challenge-token protocol.

The password starts hidden. Tap the eye icon to show or hide it; the entered value is preserved. The toggle is labelled **Show password** / **Hide password** for accessibility and is disabled during sign-in.

Sign in to discover **COE Door (simulated)**. Tap **Unlock COE Door**, then choose **Cancel** or **Unlock** in the themed confirmation modal. Confirmation shows **Simulated unlock accepted. No physical door was operated.** Tap **Sign out** to open a confirmation modal. Choose **Sign out** inside the modal to end the session, or **Cancel** to keep using the door screen.

[Sonner Native](https://sonner-native.netlify.app/) relays sign-in errors, unavailable access, accepted unlock requests and unconfirmed results. Notifications match the system light/dark theme, disappear after five seconds, and can be tapped or swiped away. The full-width positioning wrapper keeps them horizontally centered; their card width is capped to the window's safe area and 480 dp. Error guidance and door outcomes remain on screen after dismissal. Signing in or out clears previous session notifications. Notifications never dispatch or retry an unlock.

Do not enter real employee credentials. Only the documented dummy accounts are handled. The current composition always selects the in-process mock adapter; there is no live adapter, environment toggle or network fallback.

## Implementation

- **S1 — Authentication/session:** real Latch logic owns safe credential/MFA errors, expiry, restoration and account isolation. Screens subscribe to identity/status metadata and never receive tokens. Sign-out immediately clears the in-memory session and discovered selection, then removes the saved token.
- **S2 — Door access:** real Latch logic resolves the returned organisation, entry and existing Cloud Key. Screens receive a selection reference and readable context rather than tokens or provider IDs.
- **S3 — Openpath adapter:** typed provider operations have an in-process adapter with fictional account/door data. `checkSession` represents a current authorized identity read, not JWT decoding or token refresh. Its live endpoint mapping belongs to phase 5. These normalized types are not a claim that the native Openpath JSON protocol is implemented.
- **S4 — User journey:** the actual Router screens use those modules. A protected stack replaces the starter Home/Explore tabs. The demo label stays visible on sign-in and door screens.

All organisation/entry/credential IDs are confined to provider data. Tests change entry/credential IDs to verify that the Latch rules use discovery rather than app configuration. The mock adapter's request history records simulated commands for tests and contains no provider token.

The reusable `AppModal` accepts a title, body, actions and close callback. It uses a native modal window with a themed, rounded card and scrim, a 220 ms opacity/scale entrance and 160 ms exit on Reanimated's UI runtime. Reduced motion removes scaling. Content scrolls within safe-area bounds at large font sizes. Cancel, Android Back and tapping the backdrop dismiss without unlocking. Journey tests render the actual modal content; the native Back callback is exercised through the native modal interface.

The clipped-toast screenshot traced to the tap-to-dismiss wrapper being centered without an explicit width around Sonner's absolutely positioned toast. The wrapper now stretches across the host, and the card has an explicit viewport-bounded width. Jest does not measure native Yoga geometry, so this fix and the modal's appearance/animation still need device visual verification.

## Session behaviour

The native composition uses [Expo SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/) with separate demo/live storage keys. It saves only the token, identity reference, environment/version and original session timestamps. Passwords, codes, cached permissions and door selections are never saved. Android backup exclusion uses SecureStore's config plugin; actual Keystore and packaged backup behaviour still require device/build verification. SecureStore has no web implementation in this app; use Android/Expo Go for this phase.

A **15-minute local cap** is an app policy, not an Alta requirement. Earlier reported provider expiry wins. Restart and foreground validation preserve the original deadline; there is no automatic refresh. Startup shows **Checking secure session…** until a current provider check completes. Discovery then reads current entry/credential data again. An outage never grants access from cached data; **Retry session check** deliberately rechecks, without sending an unlock.

Expiry, definitive token rejection, sign-out and account replacement invalidate door choices. Delayed login, restoration, discovery and unlock responses are bound to their originating app session. Native storage operations are serialized within that app instance, so a delayed write cannot undo a later logout. The UI suppresses notifications from a door screen that has already lost its session.

Storage read/write/delete failures block authentication with recovery guidance. If deletion fails, logout attempts to overwrite the stored token with an unusable value; recovery clears it before fresh sign-in. If both native mutations fail, physical token erasure cannot be guaranteed. Local sign-out does not claim vendor-wide token revocation.

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

**Latest automated result:** 2 suites, 43 tests passing; lint and typecheck passing. Notification tests render the actual Sonner component. Phase 2 adds SDK-compatible `expo-secure-store` and its config plugin. The Phase 2 Android production JavaScript/Hermes export passed; this checks Metro compilation, not APK packaging or native runtime behaviour.

## Evidence limits and next phases

No connected Android device/emulator was available when checked, so no device smoke test, APK build, live tenant test or physical unlock was performed. JavaScript journey tests do not establish native layout, keyboard, TalkBack or hardware behaviour. App icons/splash assets remain starter assets pending the branding/delivery phase.

Phase 2 adds multiple authentication scenarios while discovery still assumes one organisation, one COE match and one Cloud Key. Broader discovery/permission cases belong to phase 3; durable pending markers, deadlines, cooldown and interruption/unknown-result recovery to phase 4. A request already sent cannot be undone by local expiry; interrupted-attempt recovery is not implemented yet. The direct HTTPS adapter comes in phase 5. Real Alta MFA/SSO eligibility, provider checks and revocation propagation remain unverified.

The detailed implementation plan remains in the workspace at `../implementation-plan.md`.
