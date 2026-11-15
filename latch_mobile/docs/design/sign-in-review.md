# Access screen refinement

The reference is [IFSS's home page](https://www.ifssgroup.com/home/), inspected on 15 November 2026: dark building imagery, red accents, white headings and restrained orange details. The supplied Android screenshot was the baseline: an additional navigation title bar, long demo instructions before the form, and little visual hierarchy.

The generated [direction image](sign-in-target.png) is **1016 × 1548 pixels**. It is a design reference, not a screenshot of the running app. Implementation retains the existing Latch vector mark, system fonts, accessible disabled-button behavior and responsive wrapping rather than copying the generated logo or flattening its controls into an image.

The implementation uses a wordmark, an in-screen sign-in title, grouped fields, 56 dp controls, a quiet authenticator action and a local SVG architecture pattern. The primary action remains the existing accessible red. Shared gutters add 24 dp to the device's top/side safe areas and 32 dp at the bottom. Content scrolls, including at larger font sizes. No external video, font, media request or extra package was added.

Only the focused sign-in screen animates the decorative layer: a ten-pixel drift over twelve seconds, reversing without a jump. It pauses while backgrounded; reduced motion removes the animation. Door, restoration and invalid-link screens use the same static background. All actual controls remain stationary. The navigation headers are hidden, while the existing door name remains its content heading.

S4 journey tests retain the real screens and now require the in-screen live title and absence of all demo account/MFA guidance. They still exercise password visibility, MFA, authentication failures and recovery, unlock confirmation, sign-out, expiry and unknown-result recovery. Tests do not measure native layout or animation smoothness.

Native visual verification is pending. No emulator or app server was started. On a phone, check the reported **360 × 780 dp** class in dark and light themes, repeat with large system text and the keyboard open, and confirm fields/buttons remain reachable. Check demo and live copy, the door screen after sign-in, and reduced motion/background/foreground behavior. The attached concept is not evidence that these native checks passed; the accompanying receipt records them as blocked pending device inspection.
