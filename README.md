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

| Variable                      | Service | Description                               |
| ----------------------------- | ------- | ----------------------------------------- |
| `PORT`                        | app     | HTTP server port (default `3000`)         |
| `BASE_URL`                    | app     | Public-facing URL                         |
| `ADMIN_EMAIL`                 | app     | Admin email address (required)            |
| `DATABASE_PATH`               | app     | SQLite directory (default `/data/`)       |
| `LITESTREAM_REPLICA_BUCKET`   | app     | S3 bucket for backups (default `backups`) |
| `LITESTREAM_REPLICA_ENDPOINT` | app     | S3 endpoint URL                           |
| `LITESTREAM_REPLICA_REGION`   | app     | S3 region                                 |
| `AWS_ACCESS_KEY_ID`           | app     | S3 access key                             |
| `AWS_SECRET_ACCESS_KEY`       | app     | S3 secret key                             |         |

## Access

This is family-only software. The configured admin email can register first, then creates accounts for other family members. No public registration.

## Privacy

All data stays on your own server. No third-party analytics, no data sharing.
