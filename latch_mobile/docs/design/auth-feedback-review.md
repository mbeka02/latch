# Authentication and processing feedback — 2026-11-16

This is a focused correction to the existing Latch screens. The standalone logo, Space Grotesk, IFSS red actions, theme surfaces, control radii and sign-in backdrop remain the visual baseline. The historical sign-in concept does not depict the new MFA step; no new image or native screenshot was generated.

## Sign-in and MFA

1. Enter email/password. The eye toggle still preserves the password. Submission hides a previously revealed password and locks editing while processing; the password value stays in memory.
2. Without MFA, select **Sign in**. For a known MFA account, choose **Use authenticator code** after entering credentials. This does not make a network request or claim authentication has succeeded.
3. **Verify your sign-in** shows the account email as read-only context, a single six-digit code input, **Verify and sign in**, **Edit sign-in details**, and **Cancel sign-in**. Email/password inputs and demo instructions are absent. The code input supports paste, one-time-code autofill and a numeric keyboard.
4. Verification submits email/password/code together through the existing login operation. The password is retained only in component memory. The direct API accepts `mfa.totpCode`; this UI does not assume an independently authenticated challenge session. See the existing [contract evidence](../openpath-contract-evidence.md#native-login) and [provider login schema](https://openpath.readme.io/reference/login).
5. Failure retains the password for recovery. Explicit MFA-invalid outcomes clear only the rejected code. Editing details clears the code and returns to the credentials; Android Back does the same when idle. While verification is pending, editing/back is blocked and the explicit cancellation action remains available. Cancellation clears password/code and invalidates the operation; a late response cannot navigate into door access or overwrite the new form. Successful sign-in clears password/code and removes the sign-in screen.

The mock provider can explicitly request MFA and distinguish an invalid code. Live 400/401/403 policy remains generic because documented machine-readable MFA/SSO error contracts have not been established. A rejected live password-only request therefore does not automatically trigger a fictitious challenge. The employee can choose the authenticator step explicitly. SSO-only accounts remain unsupported.

## Feedback shared across screens

- `InlineMessage` uses a semantic icon, selectable alert text in the existing bold font face, a tinted surface and an accent edge. Theme tokens provide readable red errors and amber warnings, avoiding a color-only distinction. Sign-in, session errors, door discovery failures, denied/not-sent unlock outcomes and screen recovery use this treatment. An unknown unlock remains a warning and still requires acknowledgement.
- `ActionButton` now owns loading behavior: an in-button native spinner alongside the label, a disabled/busy accessibility state and no repeat activation. The compact door action uses the same component as the form/modal actions. Sign-in, MFA, unlock, acknowledgement, access retry, screen retry and the opt-in monitoring test supply their real pending state. Navigation and modal-opening actions remain immediate. Session restoration has a separate native progress indicator; pull-to-refresh retains RefreshControl.
- Existing confirmation, one-request unlock policy, uncertain-result recovery, native origin and user-scoped permission rules are unchanged. No new dependency, service, build or deployment was introduced.

## Verification and limits

Tests remain at the previously agreed real Router seam, using external provider/native fixtures. The deferred sign-in regression first failed because the password was empty while the request was pending; it now checks preserved input, hidden/locked editing, busy state, duplicate suppression and failure recovery. The MFA regression first failed because the same form remained visible; it now covers the code-only step, invalid-code correction and successful sign-in without retyping the password. Live fixtures verify that moving into/out of the code step sends no login until explicit verification, preserves credential values and submits TOTP in the same request. Cancellation is exercised with a pending verification and a late successful response.

**156 tests across seven suites**, lint and typecheck passed. These are JavaScript tests with mocked external/native boundaries, not screenshots or proof of live MFA behavior. No emulator, Metro server, APK build, EAS job or real login/unlock request was run. Source hashes and outstanding device checks are recorded in [the verification receipt](auth-feedback-evidence.json).

On the next authorized phone run, inspect light/dark themes at the reported **360 × 780 dp** class, then large system text and an open keyboard. Check password visibility while processing, code paste/autofill, transitions and Android Back, errors after correction, the compact unlock spinner, acknowledgement and access retry. Verify that errors and all actions remain reachable by scrolling and with a screen reader. Native rendering, keyboard movement, autofill and assistive announcement behavior remain unverified.
