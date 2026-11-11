Security audit — 2026-11-11

Implementation update: the application now checks Cloudflare's `X-Origin-Secret`
against the runtime `ORIGIN_SECRET` before session handling, rate limiting, and
serving application routes/assets. Production requires the secret; the minimal
`GET /health` endpoint remains public. This addresses finding 3 after deployment
with the matching Cloudflare request-header rule. Automated tests cover rejection,
proxy-header spoofing, preserved login requirements, and configuration failures;
live deployment verification remains outstanding.

Deployment clarification: the user deploys the Dockerfile through Coolify, with
Cloudflare → Traefik → app on port 3000. The Compose RustFS service is not used,
so finding 1 does not apply to this deployment. Other findings remain open.

The application rejects unauthenticated requests at its app/admin route boundaries, but the authentication system and deployment defaults have security gaps. This audit reviewed the current working tree, including existing uncommitted changes. No application code or deployment settings were changed.

Scope: route authentication, admin authorization, login throttling, initial registration, session lifecycle, invitation handling, password storage, and supplied deployment configuration. Tests ran in-process against the actual Hono app with a fresh temporary SQLite database and synthetic users. No production traffic or production data was used. Live firewall, Cloudflare, Traefik, TLS, backup permissions, and deployed versions were not inspected. This is not a comprehensive dependency, XSS, or infrastructure penetration test.

**Verified protections**

- All 72 distinct registered GET/POST endpoints under `/app` and `/admin` redirected to login for missing, malformed, and nonexistent session cookies (216 checks). POST checks supplied a same-origin header so CSRF rejection did not mask missing authentication guards.
- Anonymous Datastar requests to the registered app endpoints returned login redirect events rather than private data.
- Valid sessions were accepted; forged session secrets and expired sessions were rejected.
- A normal user received HTTP 403 at `/admin`.
- Logout invalidated the session for subsequent requests.
- A cross-origin form POST to login returned HTTP 403.
- Ten login attempts under one IP header were processed; the eleventh returned HTTP 429.
- Session secrets and invite tokens are stored hashed. Cookies are HttpOnly and SameSite=Lax, with Secure enabled in production. Authentication SQL uses bound parameters. Login errors use a generic message.

**Findings, in priority order**

1. **High — backups exposed with default credentials in the supplied deployment.** `docker-compose.yml:37` publishes RustFS ports 9000 and 9001 on all host interfaces and sets both credentials to `rustfsadmin`. The app replicates its SQLite database to this service, so anyone able to reach it with those credentials could access backups containing private family data and authentication records without an app login. Exploitability depends on firewall/network exposure and whether these defaults are used. Remove public bindings (use an internal network or loopback for administration), replace credentials with deployment secrets, and rotate credentials if this configuration has been exposed. Check backup access logs and permissions.

2. **High — first admin registration does not prove ownership.** `src/pages/auth/index.ts:375` only compares the submitted email with ADMIN_EMAIL before creating an admin and issuing a session. On a fresh database, a stranger who knows or guesses that email can choose the admin password. Reproduced locally: unauthenticated registration returned 302 and created an admin without email verification. This does not bypass registration closure once the configured account exists. Bootstrap through a local administrative command or a strong one-time setup secret; alternatively verify email ownership before enabling the account. Keep setup closed by default.

3. **High, deployment-dependent — client-controlled header bypasses login throttling.** `src/lib/auth/rate-limit.ts:28` unconditionally trusts `CF-Connecting-IP`. Reproduced: after the eleventh attempt returned 429, changing only that header allowed another attempt (200). The supplied Compose file publishes the app on port 3000, so the repository does not enforce the assumed Cloudflare-only path. Accept forwarded IP information only through a verified proxy boundary, block direct origin access, and use a trustworthy socket IP otherwise. Requests without the header all share the `unknown` bucket, allowing one client to exhaust the allowance for all such users.

4. **Medium — brute-force controls do not follow the account or survive restarts.** `src/lib/auth/rate-limit.ts:14` keeps counters only in process memory and keys them by IP and literal URL path. Distributed clients can each try ten guesses against the same account every 15 minutes; restarting the process resets limits, and multiple instances have independent allowances. Invitation URLs each get a separate bucket. Add persistent/shared counters for normalized account identity and trustworthy IP, with bounded cooldowns and stable endpoint bucket names. Add structured failed-login and throttling events with alerting; there is no application-level security event logging in these paths. Do not log passwords, session cookies, or invitation secrets. OWASP recommends account-associated throttling: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

5. **Medium — active live-update streams survive session revocation.** `src/lib/cqrs/sse-resource.ts:22` checks the user only when opening the stream. Later events reload private state using the captured user, without checking whether the session still exists or has expired. `src/lib/cqrs/form-resource.ts:79` follows the same pattern. A focused integration test using the real session middleware and SSE resource received a private update after deleting all sessions for the user. Someone retaining an open connection can therefore continue receiving updates after logout/revocation. Close streams when their session is revoked, revalidate before sending data, and enforce expiry while idle. Cover both SSE implementations.

6. **Medium — password hashing work factor is below current guidance.** `src/lib/auth/crypto.ts:55` and `:91` use PBKDF2-HMAC-SHA256 with 100,000 iterations. Current OWASP guidance lists 600,000 for this variant. This matters if password hashes are stolen, especially alongside exposed backups. Use a versioned hash format and migrate hashes after successful authentication, with a benchmarked cost or a supported memory-hard algorithm. Do not simply change the verifier's iteration count: existing hashes would stop working. Source: https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Password_Storage_Cheat_Sheet.md

**Additional hardening**

- `src/pages/auth/index.ts:600` performs logout on GET, so a cross-site navigation can log users out. Use a POST protected by CSRF checks.
- `src/lib/auth/user.ts:97` returns immediately for unknown/passwordless accounts but hashes a password for active accounts, creating an account-enumeration timing signal. Perform equivalent password work for unsuccessful lookups.
- Private HTML responses lack an explicit `Cache-Control: no-store` policy. Add it to authenticated and authentication responses and ensure the reverse proxy/CDN never caches them. Existing SSE responses use `no-cache`; the service worker does not currently cache app pages.
- Invitation consumption reads and deletes in separate queries (`src/lib/auth/registration-token.ts:46`). Use an atomic conditional delete/returning or transaction to enforce single use across concurrent connections. The local single-client concurrency check consumed it once; a replay race was not demonstrated.
- Session expiry rolls forward and has no absolute lifetime. Choose an explicit absolute lifetime and provide a way to revoke other devices. Validate production configuration so an omitted NODE_ENV cannot silently remove the Secure cookie attribute.

**Validation limits and next steps**

The most urgent deployment checks are whether ports 3000/9000/9001 are externally reachable, whether backup defaults were replaced, and whether the origin can only receive requests from trusted proxies. Fix the confirmed application findings and preserve regression coverage for route guards, spoofed IP headers, bootstrap authorization, and data streaming after logout. The local reproduction script is `/tmp/mum-security-audit.mjs`; it creates its own `/tmp/mum-security-db-*` database and does not load `.env`.
