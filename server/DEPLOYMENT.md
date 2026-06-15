# PostgreSQL deployment guide for Karlo Wear

## DATABASE_URL format

Prisma expects a standard PostgreSQL connection string:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

### Examples

**Local development** (with `docker-compose.yml` in the repo root):

```
DATABASE_URL="postgresql://karlo:karlo@localhost:5432/karlo_wear?schema=public"
```

**Production** (managed PostgreSQL, e.g. Neon, Supabase, RDS, Railway):

```
DATABASE_URL="postgresql://app_user:STRONG_PASSWORD@db.example.com:5432/karlo_wear?schema=public&sslmode=require"
```

### Environment variables

Copy `server/.env.example` to `server/.env` and set at minimum:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_API_TOKEN` | Admin panel secret |
| `TELEGRAM_BOT_TOKEN` | Optional — order notifications |
| `TELEGRAM_ADMIN_CHAT_ID` | Optional — admin chat for notifications |
| `CLIENT_ORIGIN` | Allowed CORS origins (comma-separated) |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `production` in production |

---

## Local PostgreSQL with Docker

From the repository root:

```bash
docker compose up -d postgres
```

Wait until the container is healthy, then configure `server/.env`:

```bash
cp server/.env.example server/.env
```

---

## Migration commands

Install dependencies (once):

```bash
npm install
```

Generate the Prisma client (required after schema changes or fresh clone):

```bash
npm run prisma:generate
```

### Development

Creates/applies migrations interactively when the schema changes:

```bash
npm run prisma:migrate
```

### Production / CI

Apply committed migrations without prompts (use on deploy):

```bash
npm run prisma:migrate:deploy
```

This runs `prisma migrate deploy` and applies everything under `server/prisma/migrations/`.

---

## Seed commands

Populate payment accounts and demo products (safe to re-run — clears and re-seeds):

```bash
npm run prisma:seed
```

Run after migrations on a fresh database.

---

## Production deploy checklist

1. Provision PostgreSQL 14+ (recommended: 16).
2. Set `DATABASE_URL` with `sslmode=require` when the provider supports TLS.
3. Set `NODE_ENV=production`, `ADMIN_API_TOKEN`, `CLIENT_ORIGIN`, Telegram vars if needed.
4. Build the app:

   ```bash
   npm run build
   ```

5. Apply migrations:

   ```bash
   npm run prisma:migrate:deploy
   ```

6. Seed only on first deploy (optional):

   ```bash
   npm run prisma:seed
   ```

7. Start the API:

   ```bash
   npm run start --workspace server
   ```

8. Serve the client `client/dist` via CDN or static host; point `VITE_API_URL` at build time if the API is on another origin.

### Connection pooling

For serverless or high-traffic deployments, use the provider’s pooled connection URL (e.g. PgBouncer, Neon pooler) as `DATABASE_URL`, or add Prisma connection pool settings per your host’s documentation.

### Uploads

Payment receipts and product images are stored on the filesystem under `server/uploads/`. In production, mount persistent storage or migrate to object storage (S3, etc.) — the database stores only file URLs.

---

## Migrating from SQLite

This project previously used SQLite. PostgreSQL migrations are a fresh baseline (`20260615170000_init`). Export any production SQLite data manually before switching; there is no automatic data migration script.
