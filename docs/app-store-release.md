# Shipping an App Store release

**Scope:** submitting the iOS app to App Store Connect via EAS. This is *not* the same as the
two on-device build skills — `ios-release` and `android-release` both produce **development**
builds signed for specific devices, which cannot be uploaded to a store. Use this document
when the goal is a build that goes to App Review.

> **Status: 2026-08-08.** Written after a review rejection under guidelines 4.8 and 2.1(b).
> The backend half of the 4.8 fix is merged; the client half is not built yet. Sections marked
> **⏳ pending** are prerequisites that do not yet hold — check them before believing this page.

---

## ⚠️ The production build talks to *staging*

`apps/mobile/eas.json`'s **production** profile sets:

```json
"EXPO_PUBLIC_API_URL": "https://api-staging.realty-ai.nl"
```

So the binary App Review runs is pointed at **`api-staging.realty-ai.nl`**, not a production
API. Every consequence below follows from this one fact:

- **Anything App Review exercises, staging must serve.** A reviewer signing in, creating an
  account, or deleting one is hitting staging.
- **Backend config gaps become App Store rejections**, not staging bugs. A missing env var on
  staging is indistinguishable, to a reviewer, from a broken feature.
- **Don't take staging down during a review window.** Reviews are asynchronous and can start
  days after submission.

If this ever changes to a real production API, update this document first — most of the
prerequisites below are only interesting because of it.

---

## Backend prerequisites — verify *before* submitting

These live in [`realty-alerts`](https://github.com/DiegoHeer/realty-alerts) and are deployed
GitOps-style via `realty-ai-platform`. The app cannot compensate for any of them.

| Env var (on `api-staging`) | Why it matters for review |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | `settings/prod.py` raises `ImproperlyConfigured` at import without them — the API won't boot at all. |
| `GOOGLE_OAUTH_IOS_CLIENT_ID` | Native iOS id_tokens carry the iOS client id as their audience. Unset ⇒ every Google sign-in from the iOS build is rejected. |
| `APPLE_BUNDLE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | **⏳ pending.** All four or none — a partial config raises `ImproperlyConfigured`. Unset means Sign in with Apple is silently unavailable, which is a **guideline 4.8 rejection**, not a degraded feature. |

Values for the four `APPLE_*` vars are prepared at
`~/.config/realty-ai/apple-signin/staging.env` (mode 600, not in any repo). `APPLE_PRIVATE_KEY`
is the `.p8` on one line with `\n` escapes; `settings/base.py` unescapes it, so either form
works.

**Also required, and not an env var:** the address in `DEFAULT_FROM_EMAIL`
(`noreply@huismusapp.com`) must be registered under **Certificates, Identifiers & Profiles →
Services → Sign in with Apple for Email Communication**. Apple matches per sender address, not
per domain — an unregistered sender means verification and password-reset mail to
Hide-My-Email users bounces. ⏳ pending: only `info@huismusapp.com` is registered today.

---

## Known rejection history — don't reintroduce these

### Guideline 4.8 — Login Services

Offering a third-party login on iOS obligates offering an equivalent privacy-preserving one.
The app ships Google sign-in on iOS (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is set in all three
EAS profiles), so **Sign in with Apple is mandatory** — there is no "reply and explain" path.

Two non-obvious constraints, both learned the hard way and both pinned by backend tests:

- **The allauth `client_id` is the bundle id, not a Services ID.** A native Apple id_token is
  issued to `com.fastvibes.huismus`. Most guides show a Services ID here, which makes every
  native sign-in fail audience validation.
- **Account deletion must revoke the Apple token.** Apple requires it of any app offering both
  Sign in with Apple and account deletion, and reviewers test it. This needs the authorization
  code, which Apple discloses exactly once — hence `POST /v1/me/apple-identity`.

See [`oauth-social-login.md`](./oauth-social-login.md) for the full design.

### Guideline 2.1(b) — Information Needed (paid content)

Triggered by a **Subscription** row in Profile → Account that opened a "coming soon"
placeholder. The app sells nothing, so an entry point implying a purchase path with no In-App
Purchase behind it reads as paid content outside IAP. The row, its route and its strings were
removed.

**Rule going forward:** don't ship UI for unbuilt billing. If subscriptions are ever added they
must go through In-App Purchase (guideline 3.1.1). `profile.test.tsx` asserts the row's absence
so it can't come back by accident.

---

## Versioning

- `apps/mobile/app.json` holds `version` (`0.1.0`) — the user-visible marketing version.
- **Build numbers are remote.** `eas.json` sets `cli.appVersionSource: "remote"` and the
  production profile sets `autoIncrement: true`, so EAS owns `buildNumber` and bumps it per
  build. The `276` in `app.json` is not authoritative — don't hand-edit it expecting an effect.
- Bump `version` by hand when the release is user-visibly new.

---

## Pre-submission checklist

1. **Backend**: every prerequisite above is live on `api-staging` — actually verified against
   the deployed API, not just merged to `main`.
2. **CI green** on `main`: lint, typecheck, and the full Jest suite.
3. **Sign in with Apple works on a real device** — not just in tests. Use the `ios-release`
   skill for a device build, sign in with a genuine Apple ID, then delete the account and
   confirm the app disappears from **Settings → Apple ID → Sign in with Apple**. That round
   trip is exactly what a reviewer performs.
4. **No placeholder UI** for unbuilt paid features (see 2.1(b) above).
5. **Build + submit**: `eas build --platform ios --profile production`, then
   `eas submit --platform ios`. Note `submit.production` in `eas.json` is currently `{}` —
   App Store Connect credentials have not been verified as configured, so budget time for
   first-run setup (ASC API key or Apple ID app-specific password).
6. **Reply to any open App Review threads** in App Store Connect. Questions like 2.1(b) are
   answered in the review thread, not by the binary — but reference the build that fixes them,
   and send the reply *with* that build rather than ahead of it.

---

## Loose ends worth cleaning up

- `eas.json`'s production profile carries `"APP_PR_NUMBER": "47"`, which looks stale and has no
  obvious consumer. Confirm it's dead and drop it.
- The two on-device skills disagree about the env file: `android-release` says `.env.local`,
  `ios-release` says `.env`. The real file for iOS is `apps/mobile/.env`.
