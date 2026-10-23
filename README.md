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

## Scripts

- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint (Expo flat config)
