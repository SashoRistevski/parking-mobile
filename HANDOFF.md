# Parking mobile — handoff

Read this first in a new session, then `kb\README.md` and `kb\parking-mobile.md` in this folder, then `C:\Users\Sasho\sasho\personal\parkking-tasks\P7-00-mobile-overview.md` and `P7-01-mobile-scaffold-auth.md`. Follow the brain-build skill. The API repo handoff is `C:\Users\Sasho\sasho\personal\parking\HANDOFF.md`.

- **Ticket / request:** P7-01, the Expo app scaffold and sign-in. Sasho reviews on his iPhone. Do not commit or push until he asks. He creates the public GitHub repo. Do not create it for him.
- **Branch / location:** `C:\Users\Sasho\sasho\personal\parking-mobile`, branch `master`. P7-01 is committed on `master`. Its parent is `f082ded`. `origin` is `git@github-sashoristevski:SashoRistevski/parking-mobile.git`. Do not rename the branch to `main`. Do not use an `https://github.com` remote. `.env` is gitignored.

## Where things stand (2026-10-23)

P7-01 is committed on `master`. Parent is `f082ded`. On 2026-10-23 Sasho registered in Expo Go, killed the app, and reopened it still signed in. The home screen shows the email. He left the overlapping `Index` title for a later design pass. There is no design task. Do not restyle the screens during P7-02.

Do not move routes from `app/` to `src/app/`. The template `AGENTS.md` says `src/app/` and EAS. The code is in `app/`. P7-02 is a free sideload, not EAS. Do not install location, notification, task-manager, or SMS packages in this task.

The API stays on this PC through Tailscale. `EXPO_PUBLIC_API_URL` is `http://desktop-77jgcp8.tailefd058.ts.net:8000/api/v1`. Paths start at `/auth/login`. The header is `Authorization: Bearer <token>`. Do not loosen that. No prices. No tokens, real plates, phone numbers, or location logs in the repo.

Every subagent is regular Composer 2.5 (`composer-2.5`). Never `composer-2.5-fast`. One at a time.

## What was asked

> `npx create-expo-app` with TypeScript and Expo Router. Screens: login, register, forgot password. Token in `expo-secure-store`. An auth context that redirects to login on a 401. Onboarding stubs for location Always, Motion and Fitness, and notifications. In Expo Go: register, log in, kill the app, reopen it still logged in. Typecheck and lint pass.

## Work done

**Verified:** `npm run typecheck` and `npm run lint` passed 2026-10-23. Bundle id `mk.sasho.parking`. Scheme `parking`. Register sends `terms` `accepted` and `device_name` `parking-mobile`. Login returns `accessToken`. Expo Go on the iPhone, 2026-10-23: register, the home screen showed the email, the app was killed, and reopening it was still signed in. `expo-crypto` `randomUUID` supplies the `Idempotency-Key`. `globalThis.crypto` is missing in Expo Go.

**Written, not verified:** nothing from the phone check.

**Not started:** P7-02, the free iOS build. Sasho asked to move to it after this commit.

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
