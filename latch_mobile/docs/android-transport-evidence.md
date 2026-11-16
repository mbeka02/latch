# Phase 5 Android transport evidence

Checked 2026-11-15. Latch remains a direct Android public client. No backend, shared credential or integration service was introduced.

## Why the local native module exists

The installed Expo 58 Android `expo/fetch` implementation rejects redirects for `redirect: 'error'`, but derives its client from React Native's OkHttp provider and constructs ordinary repeatable byte-array POST bodies. JavaScript's `fetch` options do not establish an absence of native retries. Sources inspected: `node_modules/expo/android/src/main/java/expo/modules/fetch/{ExpoFetchModule,NativeRequest,NativeResponse}.kt` and `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/OkHttpClientProvider.kt`. The [versioned Expo documentation](https://docs.expo.dev/versions/v58.0.0/sdk/expo/) describes fetch; the [local-module workflow](https://docs.expo.dev/modules/get-started/) supports app-owned Android modules without manually maintaining generated app projects.

`modules/latch-openpath-transport` is an Expo-scaffolded Android-only module. It owns an isolated OkHttp client and exposes only request/cancel operations. The TypeScript adapter provides documented relative paths; native code independently restricts methods, paths and query shape. The production constructor fixes the origin to `https://api.openpath.com/`. The alternate origin/TLS client constructor is package-private and used only by JVM fixtures; JavaScript cannot choose an origin or trust configuration. Android's normal TLS certificate and hostname checks remain enabled.

The client rejects redirects, disables connection recovery, cookies, cache and authentication handlers, marks POST bodies one-shot, and permits one network exchange per request. This matters because disabling connection recovery alone does not prevent HTTP follow-ups. See the pinned [OkHttp 4.9.2 follow-up implementation](https://github.com/square/okhttp/blob/parent-4.9.2/okhttp/src/main/kotlin/okhttp3/internal/http/RetryAndFollowUpInterceptor.kt) and [RequestBody contract](https://github.com/square/okhttp/blob/parent-4.9.2/okhttp/src/main/kotlin/okhttp3/RequestBody.kt).

An independent native cancellation timer caps a call at fifteen seconds, alongside the JavaScript deadline and OkHttp's configured call timeout. This timer is necessary evidence, not an assumption: the slow-response fixture exceeded the configured OkHttp deadline when the test dependency graph used Expo's Okio 3.16.0. Explicit native cancellation passed with that combination. Earlier socket/read errors may finish sooner. Timers bound local work; neither cancellation nor expiry retracts an unlock that reached Alta.

Responses are limited to 1 MiB before crossing to JavaScript; JSON request text is limited to 65,536 characters. Native exceptions do not include response bodies or submitted credentials. No React Native HTTP debugging interceptors are installed on this client. No token is placed in a URL. Raw JWT authorization is added only to supported authenticated routes.

## Reproducing the fixture checks

The small standalone JVM harness compiles the exact production Java transport source, not a reimplementation. It exists because Jest cannot establish native HTTP policy and an emulator is unnecessary for this check. Dependencies are pinned to OkHttp/MockWebServer/TLS 4.9.2 and Okio 3.16.0, matching the installed RN version catalog and Expo's newer Okio requirement. The final APK's resolved graph must be checked again in phase 6.

With Gradle 8.10.2 and a compatible JDK (Android Studio's bundled JDK worked; system Java 25 did not):

```sh
cd modules/latch-openpath-transport/transport-tests
gradle --no-daemon test
```

Use your Gradle installation or cached distribution; no generated root `android/` directory is required. All requests stay on local fixture servers. The redirect fixture uses a locally trusted HTTPS certificate and a separate destination server, and verifies no credential forwarding. Maven dependency downloads are public; fixtures contain fictional data only.

**Result: 10 JVM tests passed.** Checks cover redirects, untrusted TLS certificate rejection, raw JWT headers, hidden `503 Retry-After: 0` unlock/read follow-ups, route restrictions, credential-safe header errors, response bounds, cancellation, queued-work teardown, and the total native deadline. The Java transport compiles and runs on the JVM. This does **not** establish that the Kotlin Expo bridge or final Android APK compiles, registers, installs or behaves correctly on a device.

## Evidence boundaries / phase 6

**2026-11-16 phase 6 update:** EAS build [`fa6ab713-730e-40e5-b92e-c7fbe71da71f`](https://expo.dev/accounts/mbeka02/projects/latch/builds/fa6ab713-730e-40e5-b92e-c7fbe71da71f) successfully compiled the Java transport and Kotlin Expo bridge in the signed release APK. Post-success Gradle dependency-insight tasks resolve OkHttp `4.9.2` and Okio/Okio JVM `3.16.0`, matching a fresh run of all ten native fixtures. APK inspection finds the retained native module name and fixed HTTPS origin in DEX; R8 obfuscates original class names. These checks establish native build/packaging and the resolved graph, not Android runtime registration, OS-level storage/interruption behavior or real TLS traffic on a phone. See [the phase 6 handoff](phase-6-handoff.md) and [APK evidence](apk-evidence.json). The bullets below describe the original phase 5 boundary; the native build/dependency items are now superseded by this update, while device/tenant checks remain pending.

- Expo Android autolinking resolves `expo.modules.latchopenpathtransport.LatchOpenpathTransportModule` from the local module. This is discovery evidence, not native compilation.
- The live-mode Android production JavaScript/Hermes export passed. A JavaScript export is not an APK or a Kotlin/native build.
- The native module is absent in Expo Go, iOS and web. Live authentication fails closed there; no generic-fetch or demo fallback exists. Default demo mode continues to work in compatible Expo Go.
- No emulator, application dev server, EAS upload, APK build, tenant login or real unlock was performed in phase 5. Metro ran only for a terminating production export.
- Phase 6 must compile/package the module, inspect resolved dependencies and permissions/backup configuration, verify release-build registration/TLS/redirect/cancellation behavior, and exercise native SecureStore/foreground/restart behavior on Android before real credential use.
- IFSS must verify the intended supported account/namespace, current-profile fields, per-user entry and Cloud Key reads, MFA behavior, permission rejection, revocation propagation and real unlock acceptance. Public schemas and fixtures cannot prove those tenant results. SSO-only flows and undocumented MFA error names are not implemented.
