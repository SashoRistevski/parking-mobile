# P7-02 Part A and Part B — unsigned iOS workflow

Read `C:\Users\Sasho\sasho\personal\parking-mobile\kb\README.md` and `kb\parking-mobile.md`, then `C:\Users\Sasho\sasho\personal\parkking-tasks\P7-02-free-ios-build-pipeline.md`. Code wins, then the task note, then `kb`.

Shell on this PC is PowerShell. The workflow itself runs on GitHub's `macos-26` runner. Do not run `xcodebuild` here. Do not dispatch the workflow. Do not commit, push, switch branches, or change git config. Do not install packages. Do not add location, notification, task-manager, or SMS packages. Do not restyle screens. Do not put secrets, tokens, plates, phone numbers, or location logs in the repo.

Stop at about 35 tool calls. Write `ops/reports/p7-02-ios-workflow-coder.md` with Done, Not done, Exact next step, Files touched, Gotchas, and Last test result. Return PARTIAL.

## Build

Add `.github/workflows/ios-unsigned.yml`.

- Trigger: `workflow_dispatch` only, with input `variant`: `dev-client` or `standalone`.
- `runs-on: macos-26`. Never a larger runner, never `macos-latest-xlarge`.
- Print `xcodebuild -version`. Use the image default when it is Xcode 26.4 or newer. Do not select an Xcode older than 26.4.
- Checkout, set up Node 24, `npm ci`. The GitHub runner uses the public npm registry. Do not set a CodeArtifact registry.
- Cache npm and CocoaPods.
- `npx expo prebuild --platform ios --clean`, then `pod install` in `ios`.
- `xcodebuild archive` for `generic/platform=iOS`. `dev-client` uses `-configuration Debug`. `standalone` uses `-configuration Release`. Signing off: `CODE_SIGNING_ALLOWED=NO`, `CODE_SIGNING_REQUIRED=NO`, `CODE_SIGN_IDENTITY=""`.
- Zip `Payload/<App>.app` into `<App>-<variant>-<shortSha>.ipa`.
- Upload that ipa as an artifact kept for 7 days.
- No secrets. No tokens in logs.

The app does not yet depend on `expo-dev-client`. Write the dev-client steps anyway. Do not add the package.

## README

Add a section a person can follow on Windows:

- Sideloadly, plus the web-installer builds of iTunes and iCloud, not the Microsoft Store builds.
- Download the artifact with `gh run download` or the browser.
- Sasho types his Apple ID into Sideloadly himself. The agent never asks for it.
- First install: Settings → Privacy & Security → Developer Mode, restart, trust the developer profile.
- The app expires 7 days after signing. Sideloadly auto-refresh needs the phone and PC on the same Wi-Fi with Sideloadly running. Otherwise sideload again by hand.
- Free Apple ID limits: at most 3 sideloaded apps, a limited number of new App IDs per week, no remote push.
- The repo is public. Anyone with a GitHub account can download the unsigned test ipa. Say that.

## Check

Run `npm run typecheck` and `npm run lint` once. Pass a timeout. Do not start a second suite if one is already running.
