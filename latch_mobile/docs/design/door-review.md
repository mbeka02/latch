# Door screen

The [1016 × 1548 design target](door-target.png) extends the existing Latch mark, Space Grotesk type and red accent. It is a generated design reference, not a runtime screenshot. The screen uses the established plain light/dark background; the sign-in architecture pattern is absent.

The header places **Account** beside the mark. It opens the existing animated `AppModal` as **Your account**, with the full selectable email, **Sign out** and **Cancel**. Opening the dialog only reveals account controls; sign-out executes only when its explicit action is pressed. Android Back and backdrop dismissal use the same close callback as Cancel. Account remains available on loading, unavailable and unconfirmed-result states, but is disabled while an unlock request or another confirmation is active. No drawer, additional route or native dependency was introduced.

The ready state separates door/location identity from a single request panel containing a static door illustration, current request readiness and the unlock button. The illustration is decorative and never changes to imply that a physical door is open or locked. Existing confirmation, permission checks, cooldown and unknown-result acknowledgement are preserved. Refresh and change controls use quieter styling; request results remain visible outside the primary panel. Loading and unavailable states have their own clear feedback.

S4 tests exercise the new Account entry point, reveal the email there (including after MFA), cancel without ending the session or requesting an unlock, and sign out from ready, unavailable and unknown-result states. The existing unlock, expiry and recovery journeys remain the regression checks.

Native visual checks are pending: inspect ready and recovery screens in both themes at the reported 360 × 780 dp viewport, long location names and large system text. Check Account readability, focus, scrolling, Back/backdrop dismissal and modal animation on a phone. No emulator or app server was started, and no native layout or smoothness pass is claimed. The accompanying `door-visual-evidence.json` records these pending checks and the current source fingerprints.
