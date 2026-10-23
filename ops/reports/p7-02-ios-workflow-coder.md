# P7-02 iOS workflow coder report

Status: **PARTIAL**

## Done

- Added `.github/workflows/ios-unsigned.yml`: `workflow_dispatch` with `variant` (`dev-client` | `standalone`), `macos-26`, Xcode version print plus fail if default is older than 26.4, Node 24, `npm ci` (public npm registry only), npm cache via `setup-node`, CocoaPods cache, `expo prebuild --platform ios --clean`, `pod install`, unsigned `xcodebuild archive` (Debug for `dev-client`, Release for `standalone`), IPA zip under `Payload/<App>.app`, artifact upload with 7-day retention. No secrets.
- README section **Install on iPhone from Windows (Sideloadly)**: web iTunes/iCloud, artifact download (`gh` or browser), public-repo warning, self-entered Apple ID, Developer Mode and trust, 7-day expiry and auto-refresh Wi‑Fi requirement, free Apple ID limits (3 apps, App ID cap, no push). Notes that `expo-dev-client` is not in the app yet.
- `npm run typecheck` and `npm run lint` pass on this PC.

## Not done

- No workflow run on GitHub (`macos-26`); IPA not produced or sideload-tested on device.
- Part C (background spike) and `docs/ios-free-build.md` are out of scope for this brief.
- Acceptance criteria 1–2 (both variants install; dev client + Metro) unverified until a run succeeds and Sideloadly install is tried.

## Exact next step

Push the branch (when Sasho asks), dispatch **iOS unsigned IPA** with `standalone`, confirm the artifact downloads and installs via Sideloadly on the iPhone. Then repeat with `dev-client` knowing Debug archive may not behave as a dev client until `expo-dev-client` is added.

## Files touched

- `.github/workflows/ios-unsigned.yml` (new)
- `README.md` (Sideloadly / Windows install section)
- `ops/reports/p7-02-ios-workflow-coder.md` (this report)

## Gotchas

- Workflow discovers the Xcode scheme from the first entry in `xcodebuild -list` after prebuild; if Expo renames the workspace or adds multiple schemes, the script may need a fixed scheme name.
- IPA file name uses the `.app` product name from the archive (Expo prebuild naming), not necessarily the `expo.name` string in `app.json`.
- `dev-client` builds Debug without `expo-dev-client`; Metro hot reload from that IPA is not expected until the package exists.
- CocoaPods cache key uses `package-lock.json` only until `ios/Podfile.lock` exists on the runner; first run may be slower.
- Do not dispatch or push from the coder session per brief; Sasho triggers the workflow after merge/push.

## Last test result

- `npm run typecheck`: pass
- `npm run lint`: pass
- GitHub Actions iOS build: not run
