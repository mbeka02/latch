# Sentry monitoring

Configured on 2026-11-15 for the user-approved **mbeka02 / latch-mobile** React Native project. The checksum-verified Sentry handoff authenticated the CLI to the intended account. Handoff/setup credentials are not application configuration and are not stored in this repository.

**Status: application integration and automated checks are ready; receipt of a real app error has not been verified.** No device was connected, and no emulator or app dev server was launched. Following [Sentry's agent setup guide](https://docs.sentry.io/ai/agent-setup/get-started/), onboarding must remain incomplete until an error from the running app is received, its issue is shown to the user, and stack quality is checked. A standalone ingestion script or a Jest mock does not meet that requirement.

## Configuration and coverage

- `@sentry/react-native` **8.35.0** was the current npm version when installed, as required by the handoff. Expo remains SDK 58; its recommended Sentry version was 8.28.x, so the newer SDK was explicitly selected. Android native compilation/compatibility remains a phase 6 check, not a result of the JavaScript export.
- Root initialization and `Sentry.wrap` capture SDK-supported JavaScript errors; native crash handling and native frame tracking are enabled in a custom native build. Expo Go/web disable the native SDK explicitly. Expo Go verification can establish JavaScript delivery only.
- Expo Router navigation tracing is enabled. Direct API operations have explicit `latch.login`, `latch.session-check`, `latch.entries`, `latch.credentials` and `latch.unlock` timing spans. Instrumentation receives a fixed operation name, never the request, token, login input or result object.
- Structured logs distinguish HTTP operation completion/failure and the application's actual unlock outcome, including `unknown` and `not-sent`. An API response and a local terminal outcome are separate observations. Neither proves physical door position or replaces Alta's access/audit records.
- Expected credential/MFA/authorization/session rejections generate warning logs rather than crash issues. Unexpected operation failures report a newly constructed error with a fixed operation/classification message; raw provider errors and causes are not captured.
- Monitoring calls are isolated from command results. SDK exceptions cannot block, change or repeat an operation. The native Openpath transport remains unchanged: no Sentry HTTP interceptor, tracing header, credential forwarding or retry was added.

`EXPO_PUBLIC_SENTRY_DSN` supplies the public ingest DSN. The local value is in ignored `.env.local`; `.env.example` documents its name. No Sentry build token is embedded in the app. `EXPO_PUBLIC_SENTRY_RELEASE` optionally overrides the native SDK's automatic release; if used, the build/upload `SENTRY_RELEASE` must match it. Without the override, preserve the SDK's native release detection so it agrees with the native build metadata.

Environments are `development-demo`, `development-live`, `production-demo` and `production-live`. Traces are sampled at **100% in development** and **10% in production**. Errors use the SDK's normal full error capture; only application-defined structured logs pass the allowlist.

## Data boundaries

The outbound JavaScript policy rebuilds events using diagnostic fields rather than recursively trusting arbitrary payloads. It drops users, requests, headers, bodies, arbitrary tags/contexts/extras, breadcrumb contents, stack locals and source-context lines. Unknown error messages are replaced with `Application error (message omitted)`; error type and source filename/function/line/column remain for diagnosis. Only fixed operation errors and the timestamped verification marker retain their messages. Source-map debug metadata is preserved.

Trace/span descriptions are fixed operation names or `navigation`; arbitrary span data and URLs are dropped. Logs accept only fixed messages plus allowlisted operation/result/duration fields. Console capture, failed-request capture, screenshots, view hierarchies, touch text extraction, automatic HTTP tracing and trace propagation are disabled. The SDK's TurboModule-context integration is excluded so it cannot attach the native transport's invocation arguments. The optional experimental Sentry Android Gradle instrumentation plugin is disabled to preserve the isolated HTTP client.

Session Replay and profiling are deferred. The app contains credentials and building-access information, so no screen recording is configured. They can be considered separately after native privacy/device verification.

**Native limitation:** JavaScript `beforeSend` filters do not filter independently generated native crash events. Native scope is never populated with employee identity, credentials or door data; native logs and screenshot/view capture are disabled. Actual native crash payloads and release-build behavior must still be inspected in phase 6 before claiming native privacy guarantees. See [Sentry's filtering documentation](https://docs.sentry.io/platforms/react-native/guides/expo/configuration/filtering/) and [sensitive-data guidance](https://docs.sentry.io/platforms/react-native/guides/expo/data-management/sensitive-data/).

## Real-app verification, without an emulator

With a supported Expo Go installation on an Android phone, start the project yourself from `latch_mobile`:

```sh
EXPO_PUBLIC_LATCH_MODE=demo EXPO_PUBLIC_SENTRY_VERIFY=1 npm start
```

Open the project on the phone. Before signing in, tap **Send Sentry test error**. The opt-in control exists only in development/demo mode. It throws and catches a real timestamped error, calls the normal initialized SDK, creates an operation trace and log, and flushes the SDK queue. It makes no Alta calls and operates no door. Its displayed marker is `Latch Sentry verification <timestamp>`; “queued” does not claim remote receipt.

The agent can then use the authenticated CLI to find that exact issue in `mbeka02/latch-mobile`, inspect its message and frames, and show its title/message/link to the user. If no event arrives, inspect the running app/init/DSN and connectivity; do not substitute a direct ingest request. After confirmation, remove the temporary control/flag and offer to resolve the test issue. Native crash verification requires the custom Android build in phase 6.

## Production build and source maps

The [official Expo setup](https://docs.sentry.io/platforms/react-native/guides/expo/) is applied manually: Sentry Metro configuration generates debug IDs; the Expo plugin identifies `mbeka02/latch-mobile` and configures native-build source-map upload. Only the two pinned Sentry CLI package install scripts were approved for local tooling; unrelated blocked scripts were left unchanged.

An Android production JavaScript/Hermes export with source maps passed, and the map contains a Sentry debug ID. Upload was explicitly disabled during this check. **No production stack trace has been symbolicated or verified.** The native APK/ProGuard or native-symbol upload path has not been exercised.

For phase 6, configure the public DSN in the selected build environment and put a build-only `SENTRY_AUTH_TOKEN` in the corresponding EAS secret environment. Do not use `EXPO_PUBLIC_` for it, commit it, paste it into chat, or reuse the one-time handoff/setup codes. The local onboarding CLI login is not proof that native build uploads are authenticated. Verify the packaged release/dist, resolved native dependencies, source-map upload and a fresh readable release-build event before declaring production monitoring complete. Uploading/deploying an APK remains phase 6 work.

## Automated evidence

Tests at the approved monitoring boundary inspect configured outbound error, log, transaction and span callbacks using independently written sensitive fixtures. Operation tests replace only the external Sentry SDK, proving single execution, safe failure reporting, expected-denial handling and tolerance of monitoring failure. Existing real Router/adapter journeys verify instrumentation wiring, unknown-result logging, and the opt-in verification control without granting door access. These tests cannot establish device behavior, native SDK filtering or Sentry receipt.

Result: **7 suites / 145 tests passed**, with lint and typecheck passing. The Sentry-enabled production Android JavaScript/Hermes export with source maps passed. The handoff's verification stages remain waiting for a real running-app error; no received issue or readable production stack has been claimed.
