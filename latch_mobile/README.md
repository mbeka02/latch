# Latch

Android-first Expo / React Native app for the IFSS assessment. **Phase 1 is a simulated demonstration only.** It makes no Alta requests, operates no physical door and needs no backend.

## Try the demo

Install the locked dependencies with `npm ci`, then run `npm start` and open the project in a compatible Expo Go installation or Android emulator.

Use these fictional credentials, also displayed on the sign-in screen:

- Email: `demo@latch.example`
- Password: `latch-demo-only`

The password starts hidden. Tap the eye icon to show or hide it; the entered value is preserved. The toggle is labelled **Show password** / **Hide password** for accessibility and is disabled during sign-in.

Sign in to discover **COE Door (simulated)**. Tap **Unlock COE Door**, then choose **Cancel** or **Unlock** in the native confirmation. Confirmation shows **Simulated unlock accepted. No physical door was operated.** Sign out returns to the sign-in screen.

[Sonner Native](https://sonner-native.netlify.app/) relays sign-in errors, unavailable access, accepted unlock requests and unconfirmed results. Notifications match the system light/dark theme, disappear after five seconds, and can be tapped or swiped away. Error guidance and door outcomes also remain on screen after dismissal. Signing in or out clears previous session notifications. The unlock confirmation stays a native dialog; notifications never dispatch or retry an unlock.

Do not enter real employee credentials. Only the documented dummy account is accepted. The current composition always selects the in-process mock adapter; there is no live adapter, environment toggle or network fallback.

## Implementation

- **S1 — Authentication/session:** real Latch logic holds the simulated provider session in memory and exposes identity metadata to screens. Sign-out clears that session and its discovered selection.
- **S2 — Door access:** real Latch logic resolves the returned organisation, entry and existing Cloud Key. Screens receive a selection reference and readable context rather than tokens or provider IDs.
- **S3 — Openpath adapter:** typed provider operations have an in-process adapter with fictional account/door data. These normalized types are not a claim that the native Openpath JSON protocol is implemented.
- **S4 — User journey:** the actual Router screens use those modules. A protected stack replaces the starter Home/Explore tabs. The demo label stays visible on sign-in and door screens.

All organisation/entry/credential IDs are confined to provider data. Tests change entry/credential IDs to verify that the Latch rules use discovery rather than app configuration. The mock adapter's request history records simulated commands for tests and contains no provider token.

The current controls use React Native's accessible fields/actions and native Alert confirmation. Device-specific rendering and dialog behaviour still need Android verification; Jest substitutes the native Alert interface rather than displaying an operating-system dialog.

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

**Latest automated result:** 2 suites, 12 tests passing; lint and typecheck passing. Notification tests render the actual Sonner component rather than mocking toast calls. The toast enhancement adds `sonner-native` and Expo SDK 58's compatible `react-native-svg`; its other peers were already installed.

The Android production JavaScript/Hermes export also passes with the toast dependencies. This checks Metro compilation, not APK packaging or native runtime behaviour.

## Evidence limits and next phases

No connected Android device/emulator was available when checked, so no device smoke test, APK build, live tenant test or physical unlock was performed. JavaScript journey tests do not establish native layout, keyboard, TalkBack or hardware behaviour. App icons/splash assets remain starter assets pending the branding/delivery phase.

Phase 1 intentionally covers one dummy identity, one organisation, one COE match and one Cloud Key. MFA, persistent secure sessions/expiry and race handling belong to phase 2; broader discovery/permission cases to phase 3; durable pending markers, deadlines, cooldown and interruption/unknown-result recovery to phase 4. A failed request already receives conservative unconfirmed-result copy, but the full lifecycle is not implemented. The direct HTTPS adapter comes in phase 5.

The detailed implementation plan remains in the workspace at `../implementation-plan.md`.
