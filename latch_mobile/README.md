# Latch

Android-first Expo / React Native app for the IFSS assessment. The intended live architecture calls Openpath directly with the evaluator's own Alta identity; this phase makes no Alta requests.

## Phase 0 — test harness and launch shell

The agreed S4 journey test renders the real Router layout and routes. It checks that launch shows **Demo mode — simulated access**, presents **Sign in**, and offers no unlock action.

The sign-in button is disabled until the mock authentication journey is implemented in phase 1. The starter tabs, Explore screen and splash remain; this is not a finished login screen or APK.

### Checks

From this directory:

```sh
npm test
npm run lint
npm run typecheck
```

`npm test` runs once without watch mode, using the Android `jest-expo` preset and React Native Testing Library. Tests live outside `src/app/`. Only native/runtime and asset support is substituted; the test uses the actual Latch screen and layout.

Tested harness: Jest 30.5.2, jest-expo 58.0.14, React Native Testing Library 14.1.0, on Node 24.21.0. The lockfile records resolved dependencies.

### TDD evidence

- **Red:** after resolving test-environment setup, the routed starter rendered and the test failed because it could not find **Demo mode — simulated access**.
- **Green:** the minimal launch shell passed the same behaviour test: one suite, one test, no snapshots.
- **Baseline repairs:** corrected the starter web tab's Pressable ref type; replaced its effect-driven theme hydration with a hydration-safe external-store subscription. Lint and typecheck pass without disabling their rules.

No authentication, door discovery, unlock adapter or backend has been implemented. No device/emulator run, APK build, tenant test or physical unlock has been performed. A JavaScript journey test does not establish native layout, accessibility or hardware behaviour.

## Development

Install the locked dependencies with `npm ci`, then start the existing Expo project with `npm start`. Use a compatible Expo Go installation or emulator for device checks. The implementation phases and agreed seams are documented in the workspace's [implementation plan](../implementation-plan.md).

Do not enter real employee credentials into this launch shell. Demo and live environments will remain explicit as their adapters are introduced.
