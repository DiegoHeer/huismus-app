# Rename `realty-ai-canvas` → `huismus-app`

**Date:** 2026-07-29
**Status:** Approved (design)

## Context

`realty-ai-canvas` was the initial working name. The product is now "Huismus" and
the app is already fully branded as such — display name `Huismus`, slug `huismus`,
deep-link scheme `huismus://`, and bundle IDs `com.fastvibes.huismus` (iOS & Android).
What still says "realty" is the **repo/tooling layer**: the GitHub repo, the npm
workspace scope, and the persisted-storage key namespace. A companion repo,
`huismus-web`, already uses the new name.

This spec renames the repo/tooling layer to match. Decision: **full internal rename**,
**no storage migration** (pre-release, no installs to protect), **everything tested
end-to-end**.

## Goal

The codebase carries zero `realty` references except deliberately-retained external
infrastructure identifiers. The repo is named `huismus-app` on GitHub.

## Scope

### In scope — what changes

**Repo identity**
- GitHub repo `DiegoHeer/realty-ai-canvas` → `DiegoHeer/huismus-app`
  (`gh repo rename`, which preserves redirects), deferred to **after merge**.
- Git `origin` remote URL updated to match (after merge).
- Root `package.json` `"name"`: `realty-ai-canvas` → `huismus-app`.
- Repo-name references in `docs/residences-list-detail-split.md` that name *this*
  repo (lines naming the "Frontend PR in `realty-ai-canvas`").

**npm workspace scope `@realty/*` → `@huismus/*`** (~185 references)
- Package names in each `package.json`:
  - `@realty/mobile` → `@huismus/mobile`
  - `@realty/data`   → `@huismus/data`
  - `@realty/i18n`   → `@huismus/i18n`
  - `@realty/types`  → `@huismus/types`
  - `@realty/ui`     → `@huismus/ui`
- Every `import … from '@realty/…'` across the codebase.
- Root `package.json` scripts (`bun --filter @realty/mobile …` → `@huismus/mobile`).
- Any internal `dependencies`/`devDependencies` entries referencing `@realty/*`.
- Re-run `bun install` to regenerate workspace symlinks under the new scope
  (lockfile change is a generated artifact, not counted toward PR size).
- Note: no `tsconfig` path mappings reference `@realty` — imports resolve via bun
  workspace symlinks, so `bun install` is what makes the new scope resolvable.

**Persisted storage keys** (no migration — pre-release)
- `apps/mobile/src/lib/storage.ts`: `PREFIX = 'realty:'` → `'huismus:'`, and the
  doc comment referencing the `realty:` namespace.
- `apps/mobile/src/lib/secure-tokens.ts`:
  - `realty.tokens`          → `huismus.tokens`
  - `realty.pending_session` → `huismus.pending_session`
  - `realty.pending_reset`   → `huismus.pending_reset`
- Update the storage-namespace references in project `CLAUDE.md` docs.

**Analytics**
- `apps/mobile/.env.example` (committed) and `apps/mobile/.env` (gitignored, local
  runtime only): `EXPO_PUBLIC_PLAUSIBLE_DOMAIN=realty-ai-canvas` → `huismus-app`.
- `apps/mobile/src/__tests__/analytics-client.test.ts`: sync the test fixture
  `'realty-ai-canvas'` → `'huismus-app'`.
- `docs/plausible-analytics.md`: any `realty-ai-canvas` site-ID references → `huismus-app`.
- ⚠️ Requires a **backend follow-up** (see below) — until the Plausible site is
  renamed, events for `huismus-app` are dropped server-side (client is
  fire-and-forget and swallows errors).

**Stray committed native iOS project — delete it**
- Repo-root `ios/` is a tracked but **stray/orphaned** Expo-prebuild artifact named
  `realtyaicanvas`. It is NOT on any build path: `bun run ios` delegates to
  `apps/mobile` `expo run:ios` (which uses the gitignored, regenerated
  `apps/mobile/ios`); EAS uses `apps/mobile/eas.json`; CI runs no native iOS build.
  The repo's own `ios-release` skill documents `apps/mobile/ios` → `Huismus` as the
  real project and explicitly calls `realtyaicanvas` the "stale committed name".
- It was minted `realtyaicanvas` because root `app.json` is a bundle-id-only stub
  with no `name`, so a stray root prebuild derived the name from root
  `package.json` `"realty-ai-canvas"` → sanitized `realtyaicanvas`.
- **Action:** `git rm -r ios` (also verify no stray root `android/` is tracked — it
  isn't). The real iOS project regenerates as `Huismus` automatically on the next
  Mac `expo prebuild --clean` (the standard `ios-release` flow). No Xcode surgery,
  nothing to hand-edit. Safe and fully verifiable on Linux (nothing consumes it;
  Jest/typecheck/lint/web-export never touch it; recoverable from git history).
- Renaming the root `package.json` (above) also prevents a future stray root
  prebuild from ever minting `realtyaicanvas` again.

### Out of scope — what stays (by design)

- **External infra domains**: `api-staging.realty-ai.nl`, `plausible.realty-ai.nl`
  (the Plausible *host*, distinct from the site ID) — DNS/backend, not renamable
  from this repo.
- **Apple Services ID** `nl.realty-ai.signin` — real Apple / backend Sign-in config
  tied to the `realty-ai.nl` domain; renaming requires Apple Developer + backend
  changes. Left as-is.
- **Cross-repo / backend references**: `realty-alerts` (backend repo),
  `realty-ai-platform` (infra repo), `~/.config/realty-ai/` (credential path),
  `Realty Alerts API` (backend product name), `/realty-api` (Metro dev-proxy
  prefix) — they name *other* projects/infra, not this app.
- **OAuth deep-link scheme** `realtyaicanvas://auth/callback` in
  `docs/oauth-social-login.md` — already stale vs app.json's `huismus://`.
  Reconciling it means updating the Google/Apple OAuth console (redirect URIs), so
  it is a **flagged follow-up**, not a code rename. Left untouched here to avoid a
  doc that claims a scheme the provider consoles don't yet accept.
- **`huismus-web`** — a separate repo with its own ~38 lingering `realty` refs
  (mostly the API domain). Not touched here.

## Execution order

1. Isolate in a git worktree (done); copy `apps/mobile/.env` into it (done).
2. **Commit A — npm scope rename**: package names + imports + jest configs + root
   scripts + internal deps; run `bun install`; commit the source + regenerated lockfile.
3. **Commit B — storage/token key rename**: `storage.ts`, `secure-tokens.ts`,
   `area-cache.ts` comment, the two tests that hardcode the keys
   (`area-cache.test.ts`, `secure-tokens.test.ts`), and the storage-namespace doc
   references (`CLAUDE.md`, `docs/backend/user-account-data-api.md`).
4. **Commit C — analytics domain**: `.env.example`, `docs/plausible-analytics.md`,
   analytics test fixture (and local `.env` for runtime verification, uncommitted).
5. **Commit D — repo identity**: root `package.json` name + `docs/*` repo-name refs.
6. **Commit E — delete stray root `ios/`**: `git rm -r ios`.
7. Full verification (see below).
8. Push branch, open **draft PR**. Pause for owner review.
9. After owner sign-off + CI green + merge:
   - `gh repo rename huismus-app`
   - update the local `origin` remote URL
   - clean up the worktree + branch
   - owner renames the local folder and the backend Plausible site (instructions
     below)

Commits are atomic and each leaves the tree in a working state (per Conventional
Commits + the repo's commit policy). The whole change is well under the ~600-LOC
soft cap once generated files (lockfile) are excluded.

## Testing (end-to-end)

All of the following must pass before the PR is marked ready:

**Build / static**
- `bun run typecheck` — proves every `@huismus/*` import resolves after the scope
  rename + `bun install`.
- `bun run lint`.

**Unit / component**
- `bun test` — all Jest suites across every package, including
  `analytics-client.test.ts` with the updated fixture.

**Visual regression**
- `bun run test:e2e` — Playwright against the Expo web export. The rename should not
  move any pixels; regenerate baselines with `bun run test:update-snapshots` only if
  a diff appears and is confirmed rename-induced (not a real regression).

**True end-to-end runtime** (the real proof the storage-key rename works)
- Launch the app via `verifier-web` and/or `verifier-android`.
- Log in → confirm the JWT is written under `huismus.tokens` (SecureStore).
- Like a listing and run a search → confirm keys are written under the `huismus:`
  namespace (AsyncStorage).
- Reload the app → confirm liked/recent state persists under the new keys.
- Confirm **no** reads/writes hit the old `realty:` / `realty.*` keys.

**Stray `ios/` deletion**
- Verify nothing references the root `ios/` (grep across CI workflows, scripts,
  `eas.json`, package scripts) and the full suite above stays green — proving
  nothing was ever built from it.
- The `Huismus` regeneration is verified on the Mac by the `ios-release` flow
  (prebuild → `Huismus.app` installs with the correct name), post-merge.

**Final residual sweep** (tracked files only)
- `git ls-files | xargs grep -lI 'realty'` returns only the deliberately-retained
  external references (Section "Out of scope"): `realty-ai.nl` domains,
  `realty-alerts` / `realty-ai-platform` / `~/.config/realty-ai/`, `Realty Alerts`,
  `/realty-api`, `nl.realty-ai.signin`, and the flagged `realtyaicanvas://` OAuth
  scheme in `docs/oauth-social-login.md`. No `@realty/`, no `realty:` keys, no
  `realty-ai-canvas` repo/Plausible refs, no committed `realtyaicanvas` native project.

## Backend / manual follow-ups (owner, after merge)

1. **GitHub + local folder**
   ```bash
   gh repo rename huismus-app                 # from the repo (redirects preserved)
   git remote set-url origin git@github.com:DiegoHeer/huismus-app.git
   # then, from ~/Projects:
   mv ~/Projects/realty-ai-canvas ~/Projects/huismus-app
   ```
   (Renaming the local folder mid-session would break worktree + tooling paths, so
   it is left to the owner.)

2. **Plausible site rename** (so analytics for `huismus-app` are accepted)
   - On the self-hosted Plausible instance at `plausible.realty-ai.nl`, rename the
     site `realty-ai-canvas` → `huismus-app` (Site Settings → General → Domain →
     "Change domain"), which preserves historical stats.
   - Verify a test event: with the app running, trigger a pageview and confirm it
     appears under the `huismus-app` site in the Plausible dashboard.

3. **iOS native regeneration** (Mac — happens naturally, no manual rename)
   - After merge, the next `ios-release` flow runs `bunx expo prebuild --platform
     ios --clean` from `apps/mobile`, regenerating `apps/mobile/ios` as
     `Huismus.xcworkspace` / `Huismus` with the correct display name (`Huismus`),
     `huismus://` + Google OAuth URL schemes, entitlements, and icon — all from
     `apps/mobile/app.json`. Nothing to hand-edit.
   - Do NOT run `expo prebuild` from the repo root (it would read the root stub
     config and could recreate a stray project).

4. **OAuth deep-link scheme reconciliation** (Google/Apple console — separate)
   - `apps/mobile/app.json` `scheme` is `huismus`, but the OAuth docs and possibly
     the provider consoles still reference `realtyaicanvas://auth/callback`. Confirm
     the Google (and Apple) authorized redirect URIs use the current
     `huismus://`-based callback, then update `docs/oauth-social-login.md`. This is
     external OAuth configuration, intentionally out of scope for the code rename.

## Risks & non-goals

- **Risk (low):** a `@realty/*` import missed by the rename → caught by `typecheck`.
- **Risk (low):** stale bundle cache serving old `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` →
  rebuild / clear Metro cache when verifying analytics.
- **Non-goal:** touching external infra (domains, Apple Services ID) or the
  `huismus-web` repo.
- **Non-goal:** storage-key migration — intentionally skipped (no installs to
  protect); existing dev installs will appear fresh, which is acceptable.
