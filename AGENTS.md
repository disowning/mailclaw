# MailClaw

Cloudflare Workers email inbox service with a Rust CLI. Receives emails via Email Routing (catch-all), stores in D1, exposes token-protected REST API for AI agents.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono.js + TypeScript
- **Database**: Cloudflare D1
- **Attachment storage**: Cloudflare R2 (`ATTACHMENTS` bucket)
- **Email Parsing**: postal-mime + html-to-text
- **CLI**: Rust (clap + reqwest + serde)
- **Package Manager**: Bun
- **Linter/Formatter**: Biome (tabs, double quotes, semicolons, 100 char width)

## Scripts

- `bun run dev` — Local dev (remote mode)
- `bun run deploy` — Deploy to Cloudflare
- `bun run tsc` — Type check
- `bun run check` — Biome lint + format check
- `bun run check:fix` — Biome lint + format with auto-fix
- `bun run lint` — Biome lint only
- `bun run lint:fix` — Biome lint with auto-fix
- `bun run format` — Biome format only
- `bun run tail` — Wrangler tail (live logs)
- `bun run cf-typegen` — Generate Cloudflare binding types
- `bun run r2:create` — Create R2 attachment bucket
- `bun run db:create` — Create D1 database
- `bun run db:tables` — Apply schema (idempotent; also adds the `attachments` table)
- `bun run db:indexes` — Apply indexes

## Project Structure

```
src/                            # Cloudflare Worker (TypeScript)
├── index.ts                    # Worker entry (fetch + email handlers)
├── app.ts                      # Hono app setup, middleware, routes
├── env.d.ts                    # CloudflareBindings secret extensions
├── types.ts                    # TypeScript types
├── middleware/auth.ts          # Bearer token auth
├── routes/emails.ts            # Email CRUD + export + send endpoints
├── routes/health.ts            # Health check
├── database/d1.ts              # All D1 query functions
├── handlers/email.ts           # Email Routing handler (parse + store)
├── providers/                  # Email send providers
│   ├── types.ts                # EmailProvider interface
│   ├── resend.ts               # Resend API provider
│   ├── cloudflare.ts           # Cloudflare Email Service provider
│   └── index.ts                # Provider factory
└── utils/                      # http, helpers, mail processing

rust-cli/                       # Rust CLI
└── main.rs                     # CLI entry (list, export, get, delete, send, health, config)

skills/mailclaw/SKILL.md        # Codex skill definition
install.sh                      # Cross-platform CLI install script
.github/workflows/
└── release-cli.yml             # CI: build + publish CLI binaries on tag push
```

## API Endpoints

All `/api/emails*` routes require `Authorization: Bearer <token>`.

- `GET /api/emails` — List (metadata only, paginated)
- `GET /api/emails/export` — List with full content (paginated)
- `GET /api/emails/:id` — Single email detail (includes `attachments` metadata)
- `DELETE /api/emails/:id` — Delete email (and its R2 attachments)
- `GET /api/emails/:id/attachments` — List attachment metadata
- `GET /api/emails/:id/attachments/:attachmentId` — Download raw attachment bytes (not the JSON envelope)
- `POST /api/emails/send` — Send email (via Resend or Cloudflare provider)
- `GET /api/health` — Health check (no auth)

### Filter params (for list + export)

`from`, `to`, `q` (keyword), `after`, `before` (date), `limit`, `offset`

## CLI

The Rust CLI (`mailclaw`) wraps the REST API. Config is stored in `~/.mailclaw/config.json`.

- `mailclaw config set --host <URL> --api-token <TOKEN>` — Save credentials
- `mailclaw config show` — Show current config
- `mailclaw list` / `export` / `get <id>` / `delete <id>` / `send` / `health` — API operations
- `mailclaw attachments <id>` — List an email's attachments
- `mailclaw download <email_id> <attachment_id> [-o path]` — Download one attachment
- All commands support `--json` for machine-readable output

### Release

Push a tag (`v*`) to trigger `release-cli.yml`, which builds binaries for linux-x86_64, linux-aarch64, macos-x86_64, macos-aarch64, and windows-x86_64, then uploads them to the GitHub Release.
