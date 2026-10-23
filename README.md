# parking-mobile

Expo app for Skopje parking reminders. Phase 7 starts with auth against the Laravel API in the private `parking` repo.

## Run in Expo Go

1. Copy `.env.example` to `.env` if you do not have one yet.
2. Install dependencies: `npm install` (use the public npm registry if your machine defaults to another).
3. Start Metro: `npx expo start` and scan the QR code with Expo Go on your iPhone.

The API base URL is `EXPO_PUBLIC_API_URL` in `.env`. Paths in the client are relative to that base (for example `/auth/login`).

## Tailscale

Expo Go on the phone must reach the API host over Tailscale. `localhost` on the PC is not visible to the phone. Connect Tailscale on both devices before testing login.

## Native identifiers

- iOS bundle identifier: `mk.sasho.parking`
- Android package: `mk.sasho.parking`
- Deep link scheme: `parking://`

Do not change the bundle identifier after the first native build; a free Apple ID only allows a few new App IDs per week.

## Privacy

Location stays on the phone except for the coordinate points a later task sends to `/locate` and session data sent to `/sessions`. This public repo must not contain API tokens, real licence plates, phone numbers, or location logs.

## Install on iPhone from Windows (Sideloadly)

Use this for unsigned test builds from GitHub Actions, not for App Store distribution.

1. On Windows, install [Sideloadly](https://sideloadly.io/). Install **iTunes** and **iCloud** from Apple’s web installers. Do not use the Microsoft Store versions; Sideloadly expects the classic installers.
2. In GitHub, open **Actions** → **iOS unsigned IPA** → **Run workflow**, choose `standalone` or `dev-client`, and wait for the run to finish. Download the `.ipa` artifact from the run summary, or from a shell with `gh` authenticated: `gh run download <run-id>`.
3. This repository is **public**. Anyone with a GitHub account can download these unsigned test IPAs from workflow artifacts. Treat them as test builds only.
4. Open Sideloadly, drag in the `.ipa`, connect the iPhone, and enter **your own Apple ID** in Sideloadly. Do not share that password with tools or agents.
5. **First install on the phone:** Settings → Privacy & Security → **Developer Mode** → on, restart when prompted, then trust the developer profile under Settings → General → VPN & Device Management.
6. Free Apple ID signing lasts **7 days**. Enable Sideloadly’s auto-refresh if you want; the phone and PC must stay on the **same Wi‑Fi** with Sideloadly running. Otherwise sideload the latest artifact again by hand.
7. **Free Apple ID limits:** at most **3** sideloaded apps at once, only a **limited number of new App IDs per week**, and **no remote push** notifications.

The `dev-client` workflow variant builds a Debug archive for a future Expo dev client. The app does not include `expo-dev-client` yet; use `standalone` for a normal Release test build until that package is added.

## Scripts

- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint (Expo flat config)
