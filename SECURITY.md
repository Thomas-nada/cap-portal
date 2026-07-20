# Security notes

Responses to the CAP Portal Wallet Connect Security Audit, and documented,
deliberate design decisions.

## Authentication model

- Wallet-based auth via CIP-30 `signData` (CIP-8). The signing key is bound to
  the claimed stake address, so a signer can only authenticate as the one
  mainnet address their key hashes to (WC-01).
- The signed payload must exactly equal the server-issued challenge (WC-02),
  and each challenge is single-use, consumed atomically (WC-12).
- Mainnet only — the backend rejects testnet (`stake_test1`) identities even
  though the key derives one (WC-10).
- JWTs carry a `jti` and can be revoked. Logout revokes the presented token
  server-side (WC-03); the session is also revoked and cleared if the wallet
  switches account or leaves mainnet (WC-11).

## Privileged bootstrap

The first admin/editor can only be self-claimed by a wallet listed in the
`BOOTSTRAP_ADMIN_STAKE` environment variable, and only while the role table is
empty. With the variable unset, bootstrap is disabled entirely (fail-closed).
There are no unauthenticated role-granting endpoints; a production start-up
guard refuses to boot if any `/dev/` route is present (WC-08, WC-09).

## Accepted risk: bearer token in localStorage (WC-05)

The bearer token is stored in `localStorage`, which is readable by any script
running on the page — so a frontend XSS bug could exfiltrate an active token.

**Decision: accepted for the current architecture, with mitigations, rather
than migrating to httpOnly cookies.** The frontend (`cap.intersectmbo.org`) and
the API (`cap-portal-api.onrender.com`) are served from **different domains**,
so an httpOnly auth cookie would be a cross-site (`SameSite=None`) cookie —
increasingly blocked by browsers as third-party, and it would introduce CSRF
surface that bearer tokens do not have. A cookie-based session would require
first co-locating the API under the frontend domain (e.g. a reverse proxy or
`api.cap.intersectmbo.org` with same-site cookies) — an infrastructure change
tracked separately.

Mitigations in place:

- Short token lifetime — `TOKEN_EXPIRE_HOURS = 12` (`backend/auth.py`).
- Server-side revocation on logout (WC-03), so a leaked token can be killed.
- Session revalidation on wallet account/network change (WC-11).
- The token is the only sensitive value stored; no keys or secrets are held
  client-side.
- XSS prevention (output escaping, no untrusted HTML injection) is the primary
  defense and should stay a review focus.

## CORS

Restricted to an explicit origin allowlist via `CORS_ORIGINS`, defaulting to
the known public frontends; any `localhost` origin is allowed for local
development only (WC-06). Credentials are disabled.

## Production guardrails

`.github/workflows/production-guard.yml` fails CI if a build would ship
`DEV_MODE = true` (dev login / testnet bypass) or expose a `/dev/` route
(WC-04). `render.yaml` is kept as `render.yaml.example` so the repo is not
treated as an auto-provisioning Render Blueprint.

## Out of scope / not present

No transaction-signing (`signTx`) flow exists; wallet signing is used only for
authentication (WC-07). If transaction signing is added later it warrants its
own review.
