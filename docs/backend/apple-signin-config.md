# Sign in with Apple — Staging Configuration

**Audience:** backend developer for the Realty Alerts API (`api-staging.realty-ai.nl`,
repo `realty-alerts`, service `services/api`); deployment config lives in
[`realty-ai-platform`](https://github.com/DiegoHeer/realty-ai-platform).
**Scope:** set the four `APPLE_*` env vars that switch Sign in with Apple on. No code
changes — the implementation merged in
[realty-alerts#241](https://github.com/DiegoHeer/realty-alerts/pull/241); this is purely
deployment config.

> **Why this is urgent.** App Store review rejected the iOS app under **guideline 4.8** —
> offering Google sign-in obliges offering Sign in with Apple. The app's App Store build
> points at `api-staging.realty-ai.nl` (`eas.json` production profile), so **App Review
> exercises staging**. If these vars are unset, Apple sign-in is silently unavailable and
> the app gets rejected again. See [`../app-store-release.md`](../app-store-release.md).

---

## 1. The four variables

| Env var | Value | Secret? |
|---|---|---|
| `APPLE_BUNDLE_ID` | `com.fastvibes.huismus` | No |
| `APPLE_TEAM_ID` | `5W85L569QN` | No |
| `APPLE_KEY_ID` | `NK2L63DZVG` | No |
| `APPLE_PRIVATE_KEY` | contents of `AuthKey_NK2L63DZVG.p8` | **Yes — signing key** |

Only the last is sensitive. The first three are identifiers that appear in plain text inside
every token Apple issues; they are safe in manifests. The `.p8` is a signing credential for
the entire Apple Developer team: it must never enter a git repo, a ticket, or a chat message.

**Source of truth** for the key file is `~/.config/realty-ai/apple-signin/` on the app owner's
machine (mirroring the existing `~/.config/realty-ai/google-oauth/` convention). Ask the owner
for it over a secure channel; Apple allows the `.p8` to be downloaded **exactly once**, so
there is no self-service recovery — a lost key means revoking it in the portal and issuing a
new one, which invalidates this configuration.

### Where the values come from

Nothing here needs to be looked up — but for future reference, in
**developer.apple.com → Certificates, Identifiers & Profiles**:

- **Team ID** — Membership details, and the `iss` of the client-secret JWT.
- **Key ID** — the key's own id under **Keys**; also the `kid` JWT header. It is embedded in
  the filename: `AuthKey_<KEY_ID>.p8`.
- **Bundle ID** — the App ID with the "Sign In with Apple" capability enabled.

---

## 2. ⚠️ The private key is multi-line — this is where it goes wrong

`APPLE_PRIVATE_KEY` holds a PEM document:

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCC...
-----END PRIVATE KEY-----
```

ES256 signing needs those newlines back. Getting this wrong is the single most likely failure,
and its symptom is unhelpful: an opaque *"Could not deserialize key data"* raised at the first
sign-in attempt, long after a green deploy.

`settings/base.py` therefore accepts **both** forms:

```python
_apple_private_key = SETTINGS.apple_private_key.replace("\\n", "\n")
```

So either of these works:

**A. Real newlines** — preferred for Kubernetes, using a YAML block scalar:

```yaml
stringData:
  APPLE_PRIVATE_KEY: |
    -----BEGIN PRIVATE KEY-----
    MIGTAgEAMBMGByqGSM49AgEGCC...
    -----END PRIVATE KEY-----
```

Mind the indentation: every line of the key must be indented under the `|`, and the closing
`-----END PRIVATE KEY-----` line is part of the value.

**B. Escaped newlines** — one line, for tooling that can't carry multi-line values:

```
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEA...\n-----END PRIVATE KEY-----\n"
```

A ready-made file in form **B** is at `~/.config/realty-ai/apple-signin/staging.env` (mode
600) on the owner's machine, containing all four variables.

> Whichever you pick, keep the trailing newline after `-----END PRIVATE KEY-----`. PEM parsers
> tolerate its absence, but preserving it avoids one more variable when debugging.

---

## 3. Deploying to staging

Secrets and manifests live in `realty-ai-platform`, not in `realty-alerts`. **Follow whatever
pattern `GOOGLE_OAUTH_CLIENT_SECRET` already uses there** — same Secret, same sealing or
encryption tooling, same ArgoCD application. That variable has the identical trust level and
lifecycle, so mirroring it keeps one mechanism rather than two.

I could not verify which secret-management tool that repo uses (it is not checked out
locally), so this document deliberately does not prescribe SealedSecrets vs. SOPS vs.
External Secrets. If Google's secret is a plain `Secret`, so is this; if it is sealed, seal
this one the same way.

The three non-secret values may live wherever the other plain config does — a ConfigMap or
the Deployment's `env:` is fine. Splitting them out is optional; keeping all four together in
the Secret is simpler and equally correct.

### Rollout order

1. Add the four variables.
2. Roll the API pods (ArgoCD sync / restart) — these are read at **import time**, so a running
   pod will not pick them up.
3. Verify with §5 below.

---

## 4. Local development (optional)

To exercise the flow locally, add the same four keys to `services/api/.env` (gitignored),
alongside the existing `GOOGLE_OAUTH_*` entries. `pydantic-settings` reads that file with
`env_file=".env"` relative to `services/api`, and there is no env prefix — the variable name
is the uppercased field name, exactly as written above.

The API boots fine without them; Apple sign-in is simply unavailable.

---

## 5. Verifying it worked

### Fast check — is the provider configured?

```bash
cd services/api && uv run python manage.py shell -c "
from django.conf import settings
apps = settings.SOCIALACCOUNT_PROVIDERS.get('apple', {}).get('APPS', [])
print('configured:', bool(apps))
print('client_id :', apps[0]['client_id'] if apps else None)
"
```

Expect `configured: True` and `client_id: com.fastvibes.huismus`. **`False` means at least one
of the four is unset** — the app list is all-or-nothing.

### Real check — does the key actually sign?

This is the one that catches a mangled PEM, because it performs the same ES256 signature the
Apple endpoints require:

```bash
cd services/api && uv run python manage.py shell -c "
from accounts.apple import _app_config, _client_secret
import jwt
token = _client_secret(_app_config())
claims = jwt.decode(token, options={'verify_signature': False}, audience='https://appleid.apple.com')
print('signed OK — iss', claims['iss'], '/ sub', claims['sub'], '/ kid', jwt.get_unverified_header(token)['kid'])
"
```

Expect `iss 5W85L569QN / sub com.fastvibes.huismus / kid NK2L63DZVG`. A traceback here means
the PEM did not survive its trip through the env var — revisit §2.

### End-to-end

Sign in with Apple from an iOS build, then delete the account in-app and confirm Huismus
disappears from **Settings → Apple ID → Sign in with Apple** on the device. That round trip is
what App Review performs.

---

## 6. Troubleshooting

| Symptom | Cause |
|---|---|
| API refuses to boot: `Sign in with Apple is partially configured: … missing` | Some but not all four are set. `settings/prod.py` rejects a half-configured state deliberately — it would otherwise look configured while every sign-in failed. Set all four, or none. |
| Sign-in returns `invalid_token`, no Apple app in config | All four unset ⇒ empty `APPS` ⇒ allauth raises `SocialApp.DoesNotExist`. Run the §5 fast check. |
| Sign-in returns `client_id_mismatch` | `APPLE_BUNDLE_ID` is not exactly what the app posts. It must be the **bundle id** (`com.fastvibes.huismus`), *not* a Services ID — see below. |
| `Could not deserialize key data` at sign-in | Mangled PEM. §2. |
| Account deletion succeeds but Apple still lists the app | Revocation is best-effort and logs a warning rather than failing the delete. Check the API logs for `Apple token revocation`. Users who signed in before this feature shipped have no stored refresh token and cannot be revoked. |

### Why the bundle id and not a Services ID

Most Sign-in-with-Apple guides — and §4.2/§6 of [`../oauth-social-login.md`](../oauth-social-login.md) —
tell you to use a **Services ID** as the allauth `client_id`. That is correct for the *browser*
flow. We ship the *native* flow, where the identity token is issued to the app's bundle id, and
allauth checks that value twice:

1. `allauth/headless/socialaccount/inputs.py` compares the posted `token.client_id` against
   `app.client_id` by **exact string equality**;
2. `AppleProvider.get_auds()` then validates the token's `aud` claim against the same string.

A Services ID here fails both. This is pinned by
`test_client_id_other_than_the_bundle_id_is_rejected` in `services/api/tests/test_apple_oauth.py`.

---

## 7. Separate but related — Apple's email relay

Not an env var, and **still outstanding**: the address in `DEFAULT_FROM_EMAIL`
(`noreply@huismusapp.com`) must be registered under **Certificates, Identifiers & Profiles →
Services → Sign in with Apple for Email Communication**, with a valid SPF record on the domain.

Users who choose "Hide My Email" get a `@privaterelay.appleid.com` address, and Apple only
relays mail from registered senders — matched **per address, not per domain**. Until this is
done, verification codes and password resets to those users bounce. This is an app-owner action
in the Apple portal, not a backend one, but it is worth knowing about when a user reports never
receiving mail.
