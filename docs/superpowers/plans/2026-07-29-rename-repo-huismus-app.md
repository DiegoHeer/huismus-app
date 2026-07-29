# Rename `realty-ai-canvas` → `huismus-app` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the repo/tooling layer from `realty-ai-canvas` to `huismus-app` — npm workspace scope, persisted-storage keys, analytics domain, repo identity — and delete the stray committed native iOS project, leaving zero `realty` references except deliberately-retained external infrastructure.

**Architecture:** Pure mechanical rename of a monorepo. No behavior changes. Because there is no new behavior, classic write-a-failing-test-first TDD does not apply — the **existing comprehensive test suite (Jest + typecheck + lint), the Playwright web export, and live runtime verification are the safety net**. Each task establishes a green baseline, applies a scoped rename, and re-runs the relevant checks to prove still-green. Changes are grouped into atomic commits, each leaving the tree in a working state.

**Tech Stack:** Bun (package manager + test scripts), TypeScript, Expo SDK 56 / React Native, Jest (`jest-expo`), `@testing-library/react-native`, Playwright, AsyncStorage + SecureStore, self-hosted Plausible.

## Global Constraints

- **Package manager:** use `bun` / `bunx` only — never `npm` / `npx`. Copied verbatim from project CLAUDE.md.
- **Commits:** Conventional Commits; atomic (one logical change per commit); tree stays working after each; never mix formatting with logic.
- **PR size:** ~600 LOC soft cap (source and tests counted separately); generated files (`bun.lock`) don't count. This rename is well under once the lockfile is excluded.
- **Testing principle:** tests define correct behavior; if source diverges, fix source — but here the change is a rename, so tests are updated *only* where they hardcode the literal old identifier being renamed (storage keys, analytics fixture).
- **New name:** repo/root-package `huismus-app`; npm scope `@huismus`; storage namespace `huismus:`; token key prefix `huismus.`; Plausible domain `huismus-app`.
- **Do NOT touch (external/other-project, verbatim):** `api-staging.realty-ai.nl`, `plausible.realty-ai.nl`, `realty-alerts`, `realty-ai-platform`, `~/.config/realty-ai/`, `Realty Alerts` (backend product name), `/realty-api` (Metro dev-proxy prefix), `nl.realty-ai.signin` (Apple Services ID), and `realtyaicanvas://auth/callback` in `docs/oauth-social-login.md` (flagged OAuth-console follow-up).
- **Platform:** development host is Linux — iOS cannot be built/tested here. The iOS work in this plan is *deletion only*; regeneration to `Huismus` happens later on a Mac via the existing `ios-release` flow.
- **Worktree:** already isolated at `.claude/worktrees/rename-huismus-app`; `apps/mobile/.env` already copied in. Run everything from the worktree root.

---

## File Structure

Files touched, grouped by the commit (task) that owns them:

- **Task 1 — npm scope:** root `package.json` (scripts + name stays for Task 4), `apps/mobile/package.json`, `packages/{data,i18n,types,ui}/package.json`, `apps/mobile/jest.config.js`, `packages/data/jest.config.js`, all `*.ts`/`*.tsx` importing `@huismus/*` (97 files), `README.md`, `docs/backend/user-account-data-api.md` (its `@huismus/*` refs), regenerated `bun.lock`.
- **Task 2 — storage keys:** `apps/mobile/src/lib/storage.ts`, `apps/mobile/src/lib/secure-tokens.ts`, `apps/mobile/src/lib/area-cache.ts` (comment), `apps/mobile/src/__tests__/area-cache.test.ts`, `apps/mobile/src/__tests__/secure-tokens.test.ts`, `CLAUDE.md`, `docs/backend/user-account-data-api.md` (its `realty:` key refs).
- **Task 3 — analytics domain:** `apps/mobile/.env.example`, `apps/mobile/.env` (local, uncommitted), `apps/mobile/src/__tests__/analytics-client.test.ts`, `docs/plausible-analytics.md`.
- **Task 4 — repo identity:** root `package.json` (`"name"`), `docs/residences-list-detail-split.md`.
- **Task 5 — delete stray ios:** repo-root `ios/` (removed).
- **Task 6 — full verification + PR:** no source changes; runs the suite, runtime checks, sweep, push, draft PR.

---

## Task 1: Rename npm workspace scope `@huismus/*` → `@huismus/*`

**Files:**
- Modify: `package.json` (scripts `bun --filter @huismus/mobile …`)
- Modify: `apps/mobile/package.json`, `packages/data/package.json`, `packages/i18n/package.json`, `packages/types/package.json`, `packages/ui/package.json` (names + internal deps)
- Modify: `apps/mobile/jest.config.js`, `packages/data/jest.config.js` (moduleNameMapper + transformIgnorePatterns)
- Modify: all `*.ts`/`*.tsx` with `@huismus/` imports (~97 files across `apps/mobile/src`, `packages/*/src`)
- Modify: `README.md`, `docs/backend/user-account-data-api.md` (`@huismus/*` mentions)
- Regenerate: `bun.lock`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the `@huismus/*` package scope that all later tasks and the app import. Package names become exactly: `@huismus/mobile`, `@huismus/data`, `@huismus/i18n`, `@huismus/types`, `@huismus/ui`.

- [ ] **Step 1: Establish green baseline**

Run:
```bash
bun install
bun run typecheck && bun test
```
Expected: both PASS. (If not, stop — the baseline is broken before any change.)

- [ ] **Step 2: Apply the scope rename across every tracked text file**

The token `@huismus/` is unambiguous, so a global literal replace is safe. Exclude the generated lockfile and the spec doc (which intentionally shows the before/after strings):
```bash
git ls-files \
  | grep -vE '(^bun\.lock$|^docs/superpowers/specs/)' \
  | xargs grep -lI '@huismus/' \
  | xargs sed -i 's#@huismus/#@huismus/#g'
```

- [ ] **Step 3: Verify no `@huismus/` remain and the new names are correct**

Run:
```bash
git ls-files | grep -vE '(^bun\.lock$|^docs/superpowers/specs/)' | xargs grep -nI '@huismus/' ; echo "exit: $?"
grep -h '"name"' package.json apps/*/package.json packages/*/package.json
```
Expected: first command prints nothing (grep exit 1 = no matches); names show `@huismus/{mobile,data,i18n,types,ui}` and root still `realty-ai-canvas` (renamed in Task 4).

- [ ] **Step 4: Regenerate workspace symlinks and the lockfile**

Run:
```bash
bun install
```
Expected: succeeds; `bun.lock` now references `@huismus/*` workspace entries. (Symlinks under `node_modules/@huismus/*` are what make imports resolve — this step is mandatory.)

- [ ] **Step 5: Verify the suite is still green under the new scope**

Run:
```bash
bun run typecheck && bun run lint && bun test
```
Expected: all PASS. `typecheck` is the key proof that every `@huismus/*` import resolves. If typecheck reports an unresolved `@huismus/...`, a package name and its importers disagree — re-check Step 2 covered that file.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename npm workspace scope @realty to @huismus"
```

---

## Task 2: Rename persisted-storage namespace `realty:` / `realty.*` → `huismus:` / `huismus.*`

**Files:**
- Modify: `apps/mobile/src/lib/storage.ts` (`PREFIX` + doc comment)
- Modify: `apps/mobile/src/lib/secure-tokens.ts` (3 key constants + comment)
- Modify: `apps/mobile/src/lib/area-cache.ts` (doc comment examples)
- Test: `apps/mobile/src/__tests__/area-cache.test.ts` (hardcoded `realty:areas:`/`realty:stats:`/`realty:cities`)
- Test: `apps/mobile/src/__tests__/secure-tokens.test.ts` (hardcoded `realty.tokens`)
- Modify: `CLAUDE.md` (storage-namespace line), `docs/backend/user-account-data-api.md` (`realty:*` key references)

**Interfaces:**
- Consumes: nothing from Task 1 (independent surface).
- Produces: runtime storage namespace `huismus:` (AsyncStorage, via `PREFIX` in `storage.ts` — `area-cache.ts` and all `StorageKeys` consumers inherit it automatically) and SecureStore keys `huismus.tokens` / `huismus.pending_session` / `huismus.pending_reset`. No migration: pre-release, existing dev installs simply appear fresh.

- [ ] **Step 1: Confirm the failing surface — tests currently assert the OLD keys**

Run:
```bash
bun test area-cache secure-tokens
```
Expected: PASS now (they assert `realty:` / `realty.tokens`). After Step 2 changes the source PREFIX/keys but before Step 3 updates these tests, they would FAIL — which is exactly why source + these tests move together in one commit.

- [ ] **Step 2: Rename the source keys**

In `apps/mobile/src/lib/storage.ts` — change the prefix constant and its doc comment:
```ts
// line ~7 comment: "All keys live under a single `huismus:` namespace."
const PREFIX = 'huismus:';
```

In `apps/mobile/src/lib/secure-tokens.ts` — change the three constants and the comment referencing the namespace:
```ts
// comment ~line 50: "…the `huismus:` colon prefix…"
const TOKENS_KEY = 'huismus.tokens';
const PENDING_SESSION_KEY = 'huismus.pending_session';
const PENDING_RESET_KEY = 'huismus.pending_reset';
```

In `apps/mobile/src/lib/area-cache.ts` — update the two example comments (`realty:areas:0518` → `huismus:areas:0518`, `realty:stats:0518` → `huismus:stats:0518`).

- [ ] **Step 3: Update the tests that hardcode the literal keys**

In `apps/mobile/src/__tests__/area-cache.test.ts`, replace every `realty:` literal with `huismus:` (keys `realty:areas:${…}`, `realty:stats:${…}`, `realty:cities`). In `apps/mobile/src/__tests__/secure-tokens.test.ts`, replace `realty.tokens` with `huismus.tokens`. A scoped sed over just these two files is safe:
```bash
sed -i 's/realty:/huismus:/g' apps/mobile/src/__tests__/area-cache.test.ts
sed -i 's/realty\.tokens/huismus.tokens/g' apps/mobile/src/__tests__/secure-tokens.test.ts
```

- [ ] **Step 4: Update the docs that document the namespace**

In `CLAUDE.md`, change the storage line: "Keys live under the `huismus:` namespace". In `docs/backend/user-account-data-api.md`, replace the app's storage-key references (`realty:likes`, `realty:recent-views`, `realty:recent-searches`, `realty:filters`, `realty:analytics-opt-out`, and the `realty:` namespace mention) with `huismus:` equivalents:
```bash
sed -i 's/realty:/huismus:/g' CLAUDE.md docs/backend/user-account-data-api.md
```
(The `realty:` token with a trailing colon matches only storage keys — `realty-alerts` / `realty-ai.nl` use a hyphen/dot and are untouched. Confirm in Step 5.)

- [ ] **Step 5: Verify tests pass and no unintended `realty:` remain**

Run:
```bash
bun test area-cache secure-tokens storage
grep -rnI 'realty:' apps/mobile CLAUDE.md docs/backend/user-account-data-api.md ; echo "exit: $?"
grep -rnI "realty\.\(tokens\|pending\)" apps/mobile ; echo "exit: $?"
```
Expected: tests PASS; both greps print nothing (exit 1). Also confirm the "leave" tokens survived: `grep -rn 'realty-alerts\|realty-ai.nl' docs/backend/user-account-data-api.md` still shows its backend references.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/storage.ts apps/mobile/src/lib/secure-tokens.ts \
        apps/mobile/src/lib/area-cache.ts \
        apps/mobile/src/__tests__/area-cache.test.ts \
        apps/mobile/src/__tests__/secure-tokens.test.ts \
        CLAUDE.md docs/backend/user-account-data-api.md
git commit -m "refactor(mobile): rename persisted storage namespace realty to huismus"
```

---

## Task 3: Point the Plausible analytics domain at `huismus-app`

**Files:**
- Modify: `apps/mobile/.env.example` (committed)
- Modify: `apps/mobile/.env` (local, gitignored — for runtime verification only, NOT committed)
- Test: `apps/mobile/src/__tests__/analytics-client.test.ts` (fixture)
- Modify: `docs/plausible-analytics.md` (site-ID references, if any)

**Interfaces:**
- Consumes: nothing.
- Produces: `EXPO_PUBLIC_PLAUSIBLE_DOMAIN=huismus-app`. The client (`packages/data`… actually `apps/mobile/src/lib/analytics/client.ts`) reads this via config; `buildEventBody(domain, …)` sets `domain` and synthesizes `url: https://${domain}${path}`. Renaming here means events are tagged `huismus-app` — requires the backend Plausible site to be renamed (follow-up) before they are accepted.

- [ ] **Step 1: Update the committed example and the local env**

```bash
sed -i 's/^EXPO_PUBLIC_PLAUSIBLE_DOMAIN=realty-ai-canvas/EXPO_PUBLIC_PLAUSIBLE_DOMAIN=huismus-app/' \
  apps/mobile/.env.example apps/mobile/.env
```

- [ ] **Step 2: Update the analytics test fixture**

In `apps/mobile/src/__tests__/analytics-client.test.ts`, change the `buildEventBody('realty-ai-canvas', …)` call and its expected `domain` / `url` fields from `realty-ai-canvas` to `huismus-app`:
```bash
sed -i 's/realty-ai-canvas/huismus-app/g' apps/mobile/src/__tests__/analytics-client.test.ts
```

- [ ] **Step 3: Update the analytics doc's site-ID references (only the site ID, not the host)**

Inspect and update only `realty-ai-canvas` site-ID occurrences (leave `plausible.realty-ai.nl` host untouched):
```bash
grep -n 'realty-ai-canvas' docs/plausible-analytics.md
sed -i 's/realty-ai-canvas/huismus-app/g' docs/plausible-analytics.md   # only if the grep shows site-ID uses
grep -n 'plausible.realty-ai.nl' docs/plausible-analytics.md            # must still be present
```
Expected: host line still shows `plausible.realty-ai.nl`; any site-ID lines now show `huismus-app`.

- [ ] **Step 4: Verify the analytics tests pass**

Run:
```bash
bun test analytics
grep -rnI 'realty-ai-canvas' apps/mobile docs/plausible-analytics.md ; echo "exit: $?"
```
Expected: analytics suite PASSES; grep prints nothing (exit 1).

- [ ] **Step 5: Commit (example + test + doc only — `.env` is gitignored)**

```bash
git add apps/mobile/.env.example apps/mobile/src/__tests__/analytics-client.test.ts docs/plausible-analytics.md
git commit -m "chore(analytics): point Plausible domain at huismus-app"
```
(Confirm `git status` shows `apps/mobile/.env` as ignored/untracked — it must not be committed.)

---

## Task 4: Rename repo identity → `huismus-app`

**Files:**
- Modify: `package.json` (`"name": "realty-ai-canvas"` → `"huismus-app"`)
- Modify: `docs/residences-list-detail-split.md` (2 refs naming *this* repo)

**Interfaces:**
- Consumes: nothing.
- Produces: root package name `huismus-app`. (This is inert for the test suite — no import references it — and also means any future stray root `expo prebuild` would sanitize to `huismusapp`, never `realtyaicanvas`.)

- [ ] **Step 1: Rename the root package**

In `package.json`, change the top-level `"name"`:
```json
"name": "huismus-app",
```

- [ ] **Step 2: Update the two doc references that name this repo**

In `docs/residences-list-detail-split.md`, lines ~169 and ~278 name the frontend repo `realty-ai-canvas`. Replace with `huismus-app`:
```bash
sed -i 's/realty-ai-canvas/huismus-app/g' docs/residences-list-detail-split.md
```
(These are the only `realty-ai-canvas` occurrences in that file — line ~7/97 references `realty-alerts`, which has a different token and is untouched. Verify next.)

- [ ] **Step 3: Verify**

```bash
grep -rnI 'realty-ai-canvas' package.json docs/residences-list-detail-split.md ; echo "exit: $?"
head -3 package.json
bun run typecheck && bun test
```
Expected: grep prints nothing (exit 1); name shows `huismus-app`; typecheck + tests PASS (rename is inert for them). Also confirm `realty-alerts` refs survive in that doc: `grep -c realty-alerts docs/residences-list-detail-split.md` > 0.

- [ ] **Step 4: Commit**

```bash
git add package.json docs/residences-list-detail-split.md
git commit -m "chore: rename root package to huismus-app"
```

---

## Task 5: Delete the stray committed root `ios/` project

**Files:**
- Remove: repo-root `ios/` (the orphaned `realtyaicanvas` Expo-prebuild artifact)

**Interfaces:**
- Consumes: nothing.
- Produces: absence of any committed native project. The real iOS project (`apps/mobile/ios`, gitignored) regenerates as `Huismus` on the next Mac `expo prebuild --clean` — out of band, not in this repo.

- [ ] **Step 1: Prove nothing consumes root `ios/` before deleting**

Run:
```bash
git ls-files | grep -E '^ios/' | head            # what will be removed (all named realtyaicanvas)
grep -rnI 'realtyaicanvas' --include='*.yml' --include='*.yaml' --include='*.json' \
  --include='*.sh' --include='*.js' --include='*.ts' . | grep -v node_modules
git ls-files | grep -E '^android/' ; echo "root android tracked exit: $?"
```
Expected: `ios/` files listed; the `realtyaicanvas` grep shows only doc/skill prose (no build config, no scripts, no `eas.json`); root `android/` grep prints nothing (exit 1 — none tracked, nothing to delete).

- [ ] **Step 2: Remove the stray project**

```bash
git rm -r ios
```

- [ ] **Step 3: Verify the tree is unaffected**

Run:
```bash
git status --short | grep '^D' | head
bun run typecheck && bun run lint && bun test
```
Expected: deletions staged; all checks PASS (nothing was ever built from `ios/`, so removing it changes nothing testable here).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(ios): remove stray committed root native project (apps/mobile is the CNG source)"
```

---

## Task 6: Full end-to-end verification + draft PR

**Files:** none (verification + delivery).

**Interfaces:**
- Consumes: the completed Tasks 1–5.
- Produces: a pushed branch and a draft PR, with recorded evidence that the full suite, the web export, and live runtime behavior all pass under the new names.

- [ ] **Step 1: Static + unit + component suite**

Run:
```bash
bun run typecheck && bun run lint && bun test
```
Expected: all PASS. Record the summary line counts.

- [ ] **Step 2: Visual regression (web export)**

Run:
```bash
bun run test:e2e
```
Expected: PASS. The rename moves no pixels; if a diff appears, confirm it is rename-induced (not a real regression) before regenerating with `bun run test:update-snapshots` and committing the new baselines in a dedicated `test:` commit.

- [ ] **Step 3: Live runtime verification (the real proof of the storage-key rename)**

Use the `verifier-web` skill (and/or `verifier-android` if a device/emulator is available) to drive the running app:
- Log in → confirm the JWT is written under `huismus.tokens` (SecureStore) and the session restores.
- Like a listing and run a location search → confirm keys are written under the `huismus:` namespace (AsyncStorage).
- Reload → confirm liked/recent state persists under the new keys.
- Confirm no reads/writes hit any `realty:` / `realty.*` key.
Record what was exercised and observed.

- [ ] **Step 4: Final residual sweep (tracked files only)**

Run:
```bash
git ls-files | grep -v '^docs/superpowers/' | xargs grep -nI 'realty' 2>/dev/null | grep -iv \
  -e 'realty-ai\.nl' -e 'realty-alerts' -e 'realty-ai-platform' -e '\.config/realty-ai' \
  -e 'Realty Alerts' -e '/realty-api' -e 'nl\.realty-ai\.signin' -e 'realtyaicanvas://'
echo "exit: $?"
```
Expected: prints nothing (exit 1) — every remaining `realty` is an approved external reference. If anything else appears, it was missed by an earlier task; fix it in that task's spirit before proceeding.

- [ ] **Step 5: Push and open the draft PR**

```bash
git push -u origin worktree-rename-huismus-app
gh pr create --draft --title "Rename realty-ai-canvas to huismus-app" \
  --body "See docs/superpowers/specs/2026-07-29-rename-repo-huismus-app-design.md.

Renames the repo/tooling layer to Huismus: npm scope @realty→@huismus, storage namespace realty:→huismus:, token keys realty.*→huismus.*, Plausible domain realty-ai-canvas→huismus-app, root package→huismus-app; deletes the stray committed root ios/ (real iOS project is apps/mobile/ios via CNG). No storage migration (pre-release). External infra (realty-ai.nl domains, realty-alerts/realty-ai-platform, Apple Services ID) intentionally left.

Post-merge follow-ups (owner):
1. gh repo rename huismus-app && git remote set-url origin git@github.com:DiegoHeer/huismus-app.git
2. mv ~/Projects/realty-ai-canvas ~/Projects/huismus-app
3. Rename the Plausible site realty-ai-canvas→huismus-app on plausible.realty-ai.nl
4. Next Mac 'expo prebuild --clean' regenerates apps/mobile/ios as Huismus
5. Reconcile the OAuth deep-link scheme (huismus:// vs realtyaicanvas://) in the Google/Apple console + docs/oauth-social-login.md"
```

- [ ] **Step 6: Monitor CI**

After the PR is created, watch the Lint & Typecheck and Tests workflows (`gh pr checks --watch`). Auto-fix mechanical failures (lint/format/type) with a follow-up commit; surface substantive failures and pause for direction. Visual Regression is non-blocking (warn-only).

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- npm scope rename → Task 1. Storage/token keys → Task 2. Analytics/Plausible domain → Task 3. Repo identity → Task 4. Stray `ios/` deletion → Task 5. End-to-end testing + residual sweep → Task 6. "Out of scope" items appear as explicit *leave/verify* checks in Tasks 2/4/6 and the Global Constraints. Post-merge follow-ups (GitHub rename, local folder, Plausible site, iOS regen, OAuth) are captured in the PR body (Task 6 Step 5) and the spec — they are owner actions, not plan tasks.

**2. Placeholder scan** — no TBD/TODO; every step has the concrete command or exact edit. The one conditional (Task 3 Step 3 doc sed "only if the grep shows site-ID uses") is guarded by an inspect-first grep, not a placeholder.

**3. Type/name consistency** — the produced names are used identically everywhere: scope `@huismus/{mobile,data,i18n,types,ui}` (Task 1 ↔ imports), namespace `huismus:` and keys `huismus.tokens`/`huismus.pending_session`/`huismus.pending_reset` (Task 2 source ↔ tests ↔ docs), domain `huismus-app` (Task 3 env ↔ fixture ↔ doc), root name `huismus-app` (Task 4). No signature drift — this plan renames identifiers rather than defining new APIs.
