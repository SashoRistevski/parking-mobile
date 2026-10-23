# P7-01 scaffold coder report

Status: **PARTIAL**

## Done

- Expo SDK 58 TypeScript app in `parking-mobile` (generated via `parking-mobile-scaffold-temp`, then moved in; `kb/` preserved).
- Expo Router, `expo-secure-store`, ESLint (Expo flat config), Prettier.
- `app.json`: iOS bundle id and Android package `mk.sasho.parking`, scheme `parking`.
- `.env.example` and local `.env` with `EXPO_PUBLIC_API_URL`; `.env` gitignored.
- API client: base URL from env, `Authorization: Bearer <token>`, `Idempotency-Key` on POST/PUT/PATCH/DELETE, 401 clears session on authenticated calls.
- Auth API helpers: login, register, forgot-password, logout, `GET /me`.
- Screens: login, register, forgot password, home (email + logout), three permission explanation screens (no permission APIs).
- README: Expo Go, Tailscale, bundle id, scheme, privacy note.
- `npm run typecheck` and `npm run lint` pass.

## Not done

- P7-01 acceptance on a physical iPhone in Expo Go (register, login, kill app, reopen still logged in).
- `create-expo --example with-router` failed on this machine; router was added manually to the blank TypeScript template instead.

## Exact next step

On the iPhone with Tailscale connected: copy `.env` if needed, run `npx expo start`, register or log in against the Tailscale API host, kill and reopen the app to confirm the token persists and home shows email.

## Files touched

- Root: `package.json`, `package-lock.json`, `app.json`, `babel.config.js`, `eslint.config.js`, `.prettierrc`, `.env`, `.env.example`, `.gitignore`, `README.md`
- `app/`: `_layout.tsx`, `index.tsx`, `(auth)/`, `(app)/` including `explain/*`
- `src/api/`, `src/auth/`, `src/components/AuthScreen.tsx`
- Removed: `App.tsx`, `index.ts`
- Report: `ops/reports/p7-01-scaffold-coder.md`

## Gotchas

- Default npm registry on this PC is AWS CodeArtifact; use `npm_config_registry=https://registry.npmjs.org/` for `create-expo`, `expo install`, and `npm install`.
- ESLint 10 breaks `eslint-config-expo` (`getFilename is not a function`); project uses ESLint 9.x.
- `create-expo --example with-router` errored before extracting files; blank-typescript + manual Expo Router setup was used.

## Last test result

- `npm run typecheck`: pass
- `npm run lint`: pass (after ESLint 9 pin)
- Expo Go / device auth flow: not run
