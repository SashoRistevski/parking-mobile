# Parking mobile — handoff

Read this first in a new session, then `kb\README.md` and `kb\parking-mobile.md` in this folder, then `C:\Users\Sasho\sasho\personal\parkking-tasks\P7-00-mobile-overview.md` and `P7-01-mobile-scaffold-auth.md`. Follow the brain-build skill. The API repo handoff is `C:\Users\Sasho\sasho\personal\parking\HANDOFF.md`.

- **Ticket / request:** P7-01, the Expo app scaffold and sign-in. Sasho reviews on his iPhone. Do not commit or push until he asks. He creates the public GitHub repo. Do not create it for him.
- **Branch / location:** `C:\Users\Sasho\sasho\personal\parking-mobile`, branch `master`, tip `37564d5`. Parent is `f082ded`. Pushed to `origin` on 2026-10-23. `origin` is `git@github-sashoristevski:SashoRistevski/parking-mobile.git`. Do not rename the branch to `main`. Do not use an `https://github.com` remote. `.env` is gitignored.

## Where things stand (2026-10-23)

P7-01 is `37564d5` on `master`, pushed 2026-10-23. Parent is `f082ded`. Sasho registered in Expo Go, killed the app, and reopened it still signed in. The home screen shows the email. He left the overlapping `Index` title for a later design pass. There is no design task. Do not restyle the screens during P7-02.

Do not move routes from `app/` to `src/app/`. The template `AGENTS.md` says `src/app/` and EAS. The code is in `app/`. P7-02 is a free sideload, not EAS. Do not install location, notification, task-manager, or SMS packages in this task.

The API stays on this PC through Tailscale. `EXPO_PUBLIC_API_URL` is `http://desktop-77jgcp8.tailefd058.ts.net:8000/api/v1`. Paths start at `/auth/login`. The header is `Authorization: Bearer <token>`. Do not loosen that. No prices. No tokens, real plates, phone numbers, or location logs in the repo.

Every subagent is regular Composer 2.5 (`composer-2.5`). Never `composer-2.5-fast`. One at a time.

## What was asked

> `npx create-expo-app` with TypeScript and Expo Router. Screens: login, register, forgot password. Token in `expo-secure-store`. An auth context that redirects to login on a 401. Onboarding stubs for location Always, Motion and Fitness, and notifications. In Expo Go: register, log in, kill the app, reopen it still logged in. Typecheck and lint pass.

## Work done

**Verified:** `npm run typecheck` and `npm run lint` passed 2026-10-23. Bundle id `mk.sasho.parking`. Scheme `parking`. Register sends `terms` `accepted` and `device_name` `parking-mobile`. Login returns `accessToken`. Expo Go on the iPhone, 2026-10-23: register, the home screen showed the email, the app was killed, and reopening it was still signed in. `expo-crypto` `randomUUID` supplies the `Idempotency-Key`. `globalThis.crypto` is missing in Expo Go.

**Written, not verified:** `.github/workflows/ios-unsigned.yml` and the Sideloadly section in `README.md` are in the commit that adds them. Local `npm run typecheck` and `npm run lint` passed on 2026-10-23. The workflow has not been run. `dev-client` is a Debug archive only. `expo-dev-client` is not installed.

**Not started:** after this push, a manual `standalone` run. Part C, the background spike and `docs/ios-free-build.md`, comes after an IPA installs. P5-09 and P7-09 (D35, wrong-zone reports) are recorded and not started.

## Environment

Host shell is PowerShell. Node v24.13.1, npm 11.8.0. This PC's default npm registry is AWS CodeArtifact. Installs need `npm_config_registry=https://registry.npmjs.org/`. ESLint is pinned to 9.x. Do not rewrite files with PowerShell `Get-Content` / `Set-Content`.

## Files

| File | What |
| --- | --- |
| `app/` | Expo Router screens. Login, register, forgot password, home, three explanation screens. |
| `src/api/` | Client, Bearer header, `Idempotency-Key` on POST, PUT, PATCH, and DELETE. |
| `src/auth/` | Token in `expo-secure-store`. 401 clears it. |
| `.env.example` | The Tailscale API URL. |
| `kb/parking-mobile.md` | Commands and the CodeArtifact quirk. |
