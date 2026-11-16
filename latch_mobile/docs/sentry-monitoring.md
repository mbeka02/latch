# Sentry monitoring

Configured on 2026-11-15 for the user-approved **mbeka02 / latch-mobile** React Native project. The checksum-verified Sentry handoff authenticated the CLI to the intended account. Handoff/setup credentials are not application configuration and are not stored in this repository.

**Status: application integration, automated checks and sign-in warning delivery are verified; release stack quality and native payload privacy remain unverified.** The 2026-11-16 investigation found three received sign-in warnings and an earlier verification issue, but did not inspect that issue's stack quality. Following [Sentry's agent setup guide](https://docs.sentry.io/ai/agent-setup/get-started/), full onboarding verification requires a received running-app error, its issue shown to the user, and stack quality checked. A standalone ingestion script or a Jest mock does not meet that requirement. No emulator was launched. Metro was briefly started at the user's request for a live UI preview, then stopped when the user chose a replacement APK.

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

Trace/span descriptions are fixed operation names or `navigation`; arbitrary span data and URLs are dropped. Logs accept only fixed messages plus allowlisted operation/result/duration, error classification, failure stage and numeric HTTP status fields. The log policy sets the configured environment and preserves only releases matching the packaged Android application identifier/version format. Console capture, failed-request capture, screenshots, view hierarchies, touch text extraction, automatic HTTP tracing and trace propagation are disabled. The SDK's TurboModule-context integration is excluded so it cannot attach the native transport's invocation arguments. The optional experimental Sentry Android Gradle instrumentation plugin is disabled to preserve the isolated HTTP client.

## Investigating sign-in failures

On **2026-11-16**, a read-only Sentry query found three `login` / `denied` warning logs at **14:28:52, 14:29:58 and 14:31:00 Africa/Nairobi** (11:28:52, 11:29:58 and 11:31:00 UTC). The installed code emits that combination only when `POST /auth/login` returns HTTP **400, 401 or 403**. Those attempts stopped at the login endpoint, before profile lookup or door discovery. No new crash issue accompanied them; the only issue returned by the two-day query was an earlier verification marker. This does not prove that the requests were suitable for this account or that revoked portal access caused the rejection.

The original logs discarded the exact status, failure duration, release and environment. Consequently, those values cannot be recovered retrospectively or used to identify the installed build from these records. The privacy callback removed the SDK's automatically supplied `sentry.release` and `sentry.environment`; failure logs also omitted timing and classification at their source. Successful HTTP responses were logged before their payloads were validated, leaving parsing failures outside the operation boundary.

**Preview 3 runtime follow-up:** a received log at **15:19:17 Africa/Nairobi** (12:19:17 UTC) identifies environment `production-live`, release `com.mbeka02.latch@1.0.0+3`, operation `login`, result `denied`, stage `response-status`, HTTP status **400**, and duration **1597 ms**. The new diagnostic log delivery is verified for this attempt; it establishes neither a successful login nor the account-specific cause of the rejection. Sentry displays `latch.error_code` as `[Filtered]`. Numeric custom fields must be queried with their numeric type: CLI Explore fields `tags[http.response.status_code,number]` and `tags[latch.duration_ms,number]`; selecting their untyped names returned null despite the values being stored. A six-hour issue query found no new issue alongside the retry. Subsequent local US/EU probe attempts were user-reported to return the same incorrect-credentials rejection; see [regional host findings](openpath-contract-evidence.md#regional-host-investigation--2026-11-16).

The diagnostics fix now records:

- `latch.operation`: `login`, `session-check` (current profile read), `entries`, `credentials` or `unlock`.
- `latch.result`, `latch.error_code` and `latch.duration_ms`: fixed outcome/classification and elapsed time, including failures.
- `latch.stage`: `transport` (no HTTP response obtained), `timeout` (JavaScript deadline expired), `response-status` (unexpected HTTP status), or `response-validation` (expected HTTP status received; response validation completed or failed according to `latch.result`).
- `http.response.status_code`: integer HTTP status, when a response was obtained.
- `sentry.environment` and a validated `sentry.release` when supplied by the SDK. Development/Expo Go may have no matching packaged release.

Response parsing and consistency checks now run inside the monitored endpoint operation. A malformed HTTP 201 login response therefore reports `login` / `failed` / `response-validation`, rather than a misleading HTTP-success log. `login` / `accepted` means the authentication response passed validation; the subsequent `session-check` must also succeed before a session is established. Pre-request local validation/storage failures are outside this HTTP boundary. No request/response bodies, raw provider messages, emails, account/organisation/door identifiers, passwords, MFA codes or tokens are recorded. An HTTP status alone still cannot establish account revocation or a particular MFA/SSO requirement.

In Sentry, open **Explore → Logs**, select **latch-mobile**, widen the time range and search `latch.operation:login`. For the original attempts, leave the environment filter at **All** because their environment was stripped. Add columns for `latch.result`, `latch.stage`, `http.response.status_code`, `latch.error_code`, `latch.duration_ms`, `environment` and `release`. Search `latch.operation:session-check` separately to investigate successful authentication followed by a rejected or malformed profile response. Expected denials appear in Logs rather than Issues. Traces are sampled, so a missing trace does not mean the request did not occur. See [Sentry's structured logging guide](https://docs.sentry.io/platforms/react-native/logs/).

These changes require a new running bundle/build; they do not modify the previously distributed APK. Source-map upload authentication remains a separate outstanding issue: missing maps affect readable stacks, and cannot recover HTTP statuses that were never recorded.

**Expo Go limitation:** live mode uses the local `LatchOpenpathTransport` native module. Expo Go does not contain that module, so live sign-in fails before sending HTTP. Metro can serve the live UI in Expo Go, but actual Alta sign-in testing requires a Latch Android development build or a rebuilt preview APK. Do not substitute a different HTTP client merely to make Expo Go login work; it would bypass the reviewed redirect/retry policy. See [Expo's development build documentation](https://docs.expo.dev/develop/development-builds/introduction/).

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

**2026-11-16 phase 6 update:** the Sentry-enabled EAS release APK compiled successfully with SDK `8.35.0`. Its public DSN is configured in the EAS preview environment. The cloud source-map task reports missing build authentication and exits successfully only because `SENTRY_ALLOW_FAILURE=true`; maps were **not uploaded**. Release/dist for that task are `com.mbeka02.latch@1.0.0+2` / `2`. Real-app receipt, runtime/native payload privacy and readable release stacks remain pending. See [the phase 6 handoff](phase-6-handoff.md). This supersedes the earlier native-compilation boundary, not the receipt/verification gate.

The [official Expo setup](https://docs.sentry.io/platforms/react-native/guides/expo/) is applied manually: Sentry Metro configuration generates debug IDs; the Expo plugin identifies `mbeka02/latch-mobile` and configures native-build source-map upload. Only the two pinned Sentry CLI package install scripts were approved for local tooling; unrelated blocked scripts were left unchanged.

An Android production JavaScript/Hermes export with source maps passed, and the map contains a Sentry debug ID. Upload was explicitly disabled during this check. **No production stack trace has been symbolicated or verified.** The native APK/ProGuard or native-symbol upload path has not been exercised.

For phase 6, configure the public DSN in the selected build environment and put a build-only `SENTRY_AUTH_TOKEN` in the corresponding EAS secret environment. Do not use `EXPO_PUBLIC_` for it, commit it, paste it into chat, or reuse the one-time handoff/setup codes. The local onboarding CLI login is not proof that native build uploads are authenticated. Verify the packaged release/dist, resolved native dependencies, source-map upload and a fresh readable release-build event before declaring production monitoring complete. Uploading/deploying an APK remains phase 6 work.

## Automated evidence

Tests at the approved monitoring boundary inspect configured outbound error, log, transaction and span callbacks using independently written sensitive fixtures. Operation tests replace only the external Sentry SDK, proving single execution, safe failure reporting, expected-denial handling and tolerance of monitoring failure. Existing real Router/adapter journeys verify instrumentation wiring, unknown-result logging, and the opt-in verification control without granting door access. These tests cannot establish device behavior, native SDK filtering or Sentry receipt.

Result after the 2026-11-16 diagnostics fix: **7 suites / 153 tests passed**, with lint and typecheck passing. Tests reproduce the missing HTTP status/stage/timing, a malformed successful login response incorrectly reported as completed, and rejection of malformed diagnostic metadata. The Sentry-enabled production Android JavaScript/Hermes export with source maps passed during the original setup. Received warning logs are confirmed above; readable production stacks and native payload privacy remain unverified.
