# Door empty state — 2026-11-17

Scoped refinement using the existing Latch Space Grotesk typography, plain background, compact line icons and red accent. No drawer, screen background pattern, warning treatment, new library or discovery request was added.

The illustrative target was generated as a 1145 × 1374 design reference. It is not an app screenshot. Implementation uses a theme-aware 176 × 144 SVG, not a raster screenshot: closed architectural doors with a small search lens, no open-door/locked/denied claim. The artwork is decorative and hidden from accessibility navigation. A 28/36 heading and normal wrapping text distinguish **No doors returned** from **No COE doors found**, with a short pull-down recovery hint. The existing Account control and refresh gesture remain available.

Actual component previews were rendered through React Native Web SSR at 400 × 520 (dark) and 320 × 520 (light), using the checked-in Space Grotesk fonts. Only the `SvgXml` host renderer was replaced by native browser SVG markup; this checks composition and wrapping, not native Android rendering. Both previews were inspected; no clipping or color mismatch was observed. Native full-screen, font scaling and TalkBack visual/device behavior were not inspected. No emulator or APK build was launched.

Router tests cover both neutral empty states (no alert, error toast or unlock action), and recovery from an empty result through pull-to-refresh without automatically unlocking.
