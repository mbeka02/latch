<p align="center">
  <img src="latch_mobile/assets/branding/icon.png" alt="Latch logo" width="88" />
</p>

# Latch

An Android door-access app built for the IFSS technical assessment. Sign in with an Avigilon Alta account, find an authorised **COE Door**, and confirm an unlock request.

## Contents

- [Overview](#overview)
- [Dependencies](#dependencies)
- [Setup and running](#setup-and-running)
- [Try the demo](#try-the-demo)
- [Build a live APK](#build-a-live-apk)
- [Checks](#checks)
- [Project structure](#project-structure)
- [Further reading](#further-reading)

## Overview

Latch connects directly to the Alta/Openpath API using each person's account. There is no backend or shared unlock credential. It discovers COE entries dynamically, checks current access before unlocking, and asks for confirmation before sending a request.

The app includes authenticator-code entry, secure session storage, pull-to-refresh, and recovery when an unlock result is uncertain. An accepted request does not confirm the physical door's position; uncertain requests are never automatically retried.

Two modes are available:

| Mode | Purpose |
| --- | --- |
| **Demo** (local default) | Fictional accounts and simulated doors; no Alta requests or physical unlocks. |
| **Live** (preview APK) | Individual Alta authentication against the IFSS EU deployment. Requires suitable door permissions and a Cloud Key. SSO-only sign-in is unsupported. |

## Dependencies

Use **Node.js 24.21+**, npm, and an Android phone. Building APKs also requires an Expo account with access to the linked EAS project and **EAS CLI 27.10+**.

| Technology | Purpose |
| --- | --- |
| Expo SDK 58, React Native, TypeScript | Android app |
| Expo Router and SecureStore | Navigation and protected local storage |
| Reanimated, React Native SVG, Sonner Native | Animation, icons and notifications |
| Local Android transport module | Direct Alta requests with redirects and automatic retries disabled |
| Sentry | Error monitoring and operation diagnostics |
| Jest and React Native Testing Library | Automated tests |

Exact versions are recorded in [package.json](latch_mobile/package.json) and its lockfile.

## Setup and running

From the repository root:

```sh
cd latch_mobile
npm ci
cp .env.example .env.local
npm start
```

Open the QR code in a compatible Expo Go installation on Android to try **demo mode**. Sentry is optional for local development; leave its DSN blank to run without monitoring.

> [!IMPORTANT]
> Live mode needs Latch's native Android module and cannot authenticate in Expo Go. Use a live preview APK for real Alta testing.

Public configuration lives in `.env.local`:

| Variable | Default / use |
| --- | --- |
| `EXPO_PUBLIC_LATCH_MODE` | `demo` locally; `live` in the preview build |
| `EXPO_PUBLIC_ALTA_NAMESPACE` | `org:ifss-group`; the API host is fixed to the EU region |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional public monitoring DSN |

Passwords, authenticator codes and upload tokens do not belong in these public variables.

## Try the demo

Use password **`latch-demo-only`** for all demo accounts:

| Email | Scenario |
| --- | --- |
| `demo@latch.example` | Successful sign-in and simulated unlock |
| `mfa@latch.example` | Authenticator step; enter `123456` |
| `multi@latch.example` | Organisation and door selection |
| `missing@latch.example` | No matching COE door |
| `unlock-denied@latch.example` | Unlock denied |
| `uncertain@latch.example` | Lost response; acknowledgement required before another attempt |

Select a door if prompted, tap **Unlock**, then confirm. Pull down to refresh access. Open **Account** to view the signed-in email or sign out.

## Build a live APK

**[Download live preview 1.0.0 (6)](https://expo.dev/artifacts/eas/5ePFlsyJsf-wv8EK-qsKNTfRcwwK9p_7WPUFAQVAMWo.apk)** to try the app without a development setup.

From `latch_mobile`, with your changes committed:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

The existing `preview` profile produces a signed, standalone live APK for direct installation. Download it from the build's EAS page and sign in with a supported Alta account; Metro is not required. See [Expo's internal distribution guide](https://docs.expo.dev/build/internal-distribution/) for installation and sharing.

The linked project's EAS preview environment already contains the public Sentry DSN and secret `SENTRY_AUTH_TOKEN` for source-map uploads. A different EAS project needs its own configuration. Upload failures block builds; never embed this token in the app.

Real door permissions and physical unlocking still require IFSS acceptance testing. Build records and download links are in the [Android handoff](latch_mobile/docs/phase-6-handoff.md).

## Checks

Run from `latch_mobile`:

```sh
npm test
npm run lint
npm run typecheck
```

Tests use mock provider/native boundaries and do not operate real doors.

## Project structure

```text
latch_mobile/
├── src/app/          # Sign-in and door screens
├── src/components/   # Shared UI
├── src/services/     # Access logic, Alta adapter and demo provider
├── src/monitoring/   # Sentry integration and privacy rules
├── modules/          # Native Android HTTP transport
├── scripts/          # Local diagnostics and asset tools
└── docs/             # Design, API evidence and release notes
```

## Further reading

- [API contracts and observed responses](latch_mobile/docs/openpath-contract-evidence.md)
- [Android transport and native test evidence](latch_mobile/docs/android-transport-evidence.md)
- [Monitoring and source-map setup](latch_mobile/docs/sentry-monitoring.md)
- [Door-screen design](latch_mobile/docs/design/door-review.md)
