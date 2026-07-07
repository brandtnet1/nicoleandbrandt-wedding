# AGENTS.md — Nicole & Brandt Wedding

## Architecture

- Monorepo with two packages: a **Vite + React SPA** at root and a **Firebase Cloud Functions** backend in `functions/`.
- Every UI component lives in **a single file, `src/App.tsx`** (~1374 lines). The `src/components/` and `src/pages/` directories are empty scaffolding. Do not create sibling component files unless splitting `App.tsx`.
- Firebase is **optional** at runtime — the `firebaseEnabled` flag gates all Firebase calls. The app renders normally without Firebase, showing a setup prompt instead.
- No test framework exists in this repo. Do not attempt to run tests or add a test runner unless explicitly asked.

## Commands

```bash
npm run dev            # Vite dev server (hot reload)
npm run build          # tsc && vite build && node scripts/copy-spa-fallback.mjs
npm run preview        # Vite preview of dist/

# Admin scripts (run with Firebase service account JSON present)
npm run set-admins         # Sets admin custom claims on Firebase Auth users
npm run preload-invitations # Loads invitations from private/invitations.tsv

# Functions (separate package)
npm run functions:build    # tsc inside functions/
npm run functions:deploy   # build + firebase deploy --only functions
```

**Build order is mandatory.** The build script runs `tsc` (typecheck) first, then `vite build`, then `scripts/copy-spa-fallback.mjs`. If typecheck fails, the build halts — do not skip `tsc`.

**SPA fallback:** `copy-spa-fallback.mjs` copies `dist/index.html` → `dist/404.html`. This is required for GitHub Pages SPA routing. Never remove it.

## TypeScript quirks

Root `tsconfig.json` enables constraints that reject common patterns:

| Setting | Effect |
|---|---|
| `erasableSyntaxOnly: true` | Rejects runtime `enum` and `namespace`. Use string unions or const objects instead. |
| `verbatimModuleSyntax: true` | Requires `import type` for type-only imports. Regular `import` of a type will error unless the import is elided at runtime. |
| `noUnusedLocals: true` | Unused local variables fail typecheck. |
| `noUnusedParameters: true` | Unused function parameters fail typecheck. |
| `moduleResolution: "bundler"` | Vite-style resolution. Do not add `.js` extensions to relative imports. |

`functions/tsconfig.json` uses `module: "NodeNext"` and `moduleResolution: "NodeNext"` — these are different from root. Do not copy settings between the two tsconfigs.

## Environment & secrets

- `.env.local` is loaded by Vite and `dotenv` in scripts. All browser-exposed variables must be prefixed with `VITE_`.
- GitHub Actions reads secrets from repo settings (see `pages.yml`). The CI maps `VITE_*` secrets to env vars at build time.
- **Never commit** `service-account*.json`, `firebase-service-account*.json`, `private/`, or `.env.local`.
- `.env.example` documents the required shape but contains no real values.

## Firebase & Firestore

- **Admin access** is controlled by a Firebase Auth **custom claim** (`admin: true`), not by whitelisting email addresses in client code. Admin UI access is gated by `getIdTokenResult()` checking `claims.admin`.
- `firebase.rules` gates all write access behind `isAdmin()` (except RSVP and guestbook creates). Do not loosen these rules without understanding the auth model.
- Cloud Functions (`functions/src/index.ts`) listens on `rsvps/{invitationId}` document writes to send confirmation emails via Resend. The function requires the Blaze plan and the `RESEND_API_KEY` secret set via `firebase functions:secrets:set`.

## CI/CD

- Push to `main` triggers `.github/workflows/pages.yml` — builds and deploys to GitHub Pages.
- The `CNAME` file (`nicoleandbrandt.com`) must be preserved for the custom domain.
- The workflow uses `npm ci` (not `npm install`) and Node 22.

## Dependencies

- React 19, React Router v7, MUI v9 (`@mui/material` v9), Firebase v12, date-fns v4.
- `@emotion/react` and `@emotion/styled` are required by MUI — do not remove them.
- `functions/` uses `firebase-functions` v7 and `firebase-admin` v13. These are pinned independently from the root Firebase SDK.
