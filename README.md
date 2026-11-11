# All Eyes on Mum

A family coordination app to help manage Mum's household when she needs extra support.

## Why This Exists

Mum is finding it harder to keep on top of household admin - bills, appointments, renewals, and the general mental load of running a home. Rather than things slipping through the cracks, this app helps the family coordinate and share the responsibility.

We're already managing our own households, so this isn't about taking over - it's about having a shared view of what needs attention, getting reminded before things become urgent, and keeping each other in the loop.

## What It Does

### Bills & Renewals

Track recurring bills, their due dates, and renewal periods. Get notified before things expire or need paying.

### Appointments

Keep a shared calendar of Mum's appointments - medical, home maintenance, or anything else that needs attending.

### Health Notes

A private space to record health updates, medication changes, or things the GP mentioned. Everyone stays informed without having to repeat conversations.

### Shared Notes

Quick notes between family members. "Boiler's making a noise", "She mentioned the gutters need clearing", "Pharmacy called about prescription".

### Observations

Record things you notice during visits. Changes in routine, mood, or capability that might be worth monitoring or discussing.

### Reminders

Proactive notifications when bills are due, appointments are coming up, or items need attention.

## Planned Features

### Email & Communications (AI-assisted)

Help manage Mum's inbox - flagging important correspondence, summarising lengthy documents, and drafting responses when needed.

## Tech Stack

- **Hono** - Lightweight TypeScript web framework
- **Datastar** - Real-time UI via Server-Sent Events
- **SQLite** (LibSQL) - Simple, reliable database
- **TailwindCSS + DaisyUI** - Clean, accessible UI

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your ADMIN_EMAIL

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

## Getting Started with Docker Compose

Docker Compose runs the app with a local S3-compatible server ([RustFS](https://rustfs.com)) for SQLite backups via [Litestream](https://litestream.io).

### 1. Configure environment

Edit `docker-compose.yml` and set `ADMIN_EMAIL` to your email address and `BASE_URL` to your domain.

### 2. Start the stack

```bash
docker compose up -d
```

This starts three services in order:

1. **rustfs** - S3-compatible object storage for database backups
2. **rustfs-init** - Creates the `backups` bucket, then exits
3. **app** - Builds and starts the application with Litestream replication

### 3. Verify

```bash
# Check all services started
docker compose ps

# View app logs
docker compose logs app -f
```

The app is available at `http://localhost:3000`.

The RustFS console is available at `http://localhost:9001` (login: `rustfsadmin` / `rustfsadmin`) to inspect backup data.

### Configuration

| Variable                      | Service | Description                                                                              |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `PORT`                        | app     | HTTP server port (default `3000`)                                                        |
| `BASE_URL`                    | app     | Public-facing URL                                                                        |
| `ADMIN_EMAIL`                 | app     | Admin email address (required)                                                           |
| `DATABASE_PATH`               | app     | SQLite directory (default `/data/`)                                                      |
| `VAPID_PUBLIC_KEY`            | app     | Phone push public key (optional, generate with `pnpm exec web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY`           | app     | Phone push private key (optional)                                                        |
| `LITESTREAM_REPLICA_BUCKET`   | app     | S3 bucket for backups (default `backups`)                                                |
| `LITESTREAM_REPLICA_ENDPOINT` | app     | S3 endpoint URL                                                                          |
| `LITESTREAM_REPLICA_REGION`   | app     | S3 region                                                                                |
| `AWS_ACCESS_KEY_ID`           | app     | S3 access key                                                                            |
| `AWS_SECRET_ACCESS_KEY`       | app     | S3 secret key                                                                            |     |

## Access

Production requires `ORIGIN_SECRET` as a runtime environment variable. Generate a
secret with `openssl rand -hex 32`, then configure a Cloudflare Request Header
Transform Rule matching the app's hostname to **Set static** `X-Origin-Secret` to
that same value. Use a request header, never a response header. In Coolify, set
`ORIGIN_SECRET` on the application and redeploy after enabling the Cloudflare rule.
Use HTTPS from Cloudflare to Traefik. Docker Compose also reads `ORIGIN_SECRET`
from the environment or `.env`.

All application routes and assets reject missing or incorrect origin secrets with
HTTP 403 before session handling and login rate limiting. `GET /health` stays
public for internal health checks. Production refuses to start without a secret;
local development can leave it empty. A valid origin secret does not replace user
login or admin permissions. Keep the secret out of source control and logs.

After deployment, check that the normal domain works and a direct-origin request
is rejected (replace the hostname and IP):

```bash
curl -i --resolve mum.example.com:443:203.0.113.10 https://mum.example.com/auth/login
```

This is family-only software. Public admin registration is disabled. Existing
accounts continue to work without any setup step.

For a fresh installation, open the application container's terminal in Coolify and run:

```bash
node dist/setup-admin.js
```

The command uses `ADMIN_EMAIL` and `BASE_URL` from the container environment and
prints a private, single-use setup URL valid for 24 hours. Open that URL through
your normal Cloudflare domain to choose the admin password. Do not share the URL.
The command refuses to reset an active admin. If setup was interrupted before a
password was set, rerunning it replaces the pending setup link. In development,
use `node --env-file=.env src/setup-admin.ts` after creating the database directory.
Admins can then invite family members from the app.

Login attempts are limited to 10 per IP per 15 minutes and 10 per normalized
account per 15 minutes. After the fifth account attempt, increasing cooldowns
apply (1, 2, 4, 8, then 16 seconds); the tenth attempt exhausts the window.
Rejected attempts do not extend the cooldown. A successful login clears that
account's counter, while its IP counter remains. Counters persist in SQLite and
are shared by processes using the same database, not by independent database
replicas. Invitation submissions share a 10-per-IP hourly allowance across URLs.

Failed logins, successful logins, and throttling produce structured JSON security
logs in the application output. Subjects are hashed email/IP identifiers;
passwords, cookies, and invitation URLs are not included in these events. Monitor
these events in your logging system; external alert delivery is not configured.

Passwords use versioned PBKDF2-SHA256 hashes with 600,000 iterations. Existing
100,000-iteration hashes are verified and upgraded on successful login. Unknown
and pending accounts still perform password work to reduce timing differences.
New passwords require at least 12 characters; existing shorter passwords remain
valid. Auth request bodies are limited to 16 KiB and passwords to 1,024 characters.

Logout is a CSRF-protected POST. The account menu also offers **Log out all
devices**. Sessions have a 30-day renewable expiry capped at 90 days from login.
Live-update streams revalidate before sending data, close immediately on local
revocation, and check idle connections every 15 seconds for expiry or revocation
by another process. Private pages and authentication responses use `no-store`.
`NODE_ENV` defaults to production so missing configuration cannot silently disable
production origin protection or secure cookies.

## Privacy

All data stays on your own server. No third-party analytics, no data sharing.
