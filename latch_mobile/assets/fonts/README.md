# Space Grotesk

Unmodified static Regular (400), Medium (500) and Bold (700) faces by Florian Karsten, distributed under the included [SIL Open Font License](OFL.txt).

Source: [Space Grotesk](https://github.com/floriankarsten/space-grotesk), pinned to commit `03507d024a01282884232081fc6011c09ff4e849`, directory `fonts/ttf/static/`. The license comes from the same commit. No font service is contacted at runtime.

The app selects the static face for each text weight and avoids synthetic bold. Headings and emphasized text use Bold, normal body copy uses Medium, and fields and secondary descriptions use Regular. Explicit monospace text retains the platform's monospace font. Runtime loading through the existing `expo-font` package supports the current Expo Go development workflow as well as the standalone APK. Font loading holds the native splash; an error permits the screens to render with system fallback.
