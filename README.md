# SplitPot

SplitPot splits shared expenses for a party or a trip. Sign in, open a pot, add expenses, and settle who pays whom. The API and the screens both run through Docker Compose.

## Requirements

Docker with Compose v2, and `make`. On Windows, `make` can be [ezwinports make](https://github.com/ezwinports/make) and the Makefile uses Git Bash (`C:\Program Files\Git\bin\bash.exe`). Node and PostgreSQL are not installed on the host.

## Run the dev stack

```sh
make dev-up
```

- App: http://localhost:5173
- Backend health: http://localhost:3000/health
- Backend readiness (checks the database): http://localhost:3000/ready

The frontend dev server proxies `/api`, `/health`, and `/ready` to the backend. Source directories are bind-mounted, so edits reload. Seeded login: `anu@example.com` / `password123`.

```sh
make logs
make dev-down
```

`make dev-up` copies `docker/env/.env.dev.example` to `docker/env/.env.dev` when that file is missing. Real env files are gitignored.

## Make targets

| Target | What it does |
| --- | --- |
| `dev-up` | Build and start Postgres, backend, and frontend in the background |
| `dev-down` | Stop the dev stack |
| `test` | Run backend tests against an ephemeral Postgres, then frontend tests, and remove the test stack |
| `prod-up` | Build and start the production images. Nginx serves the frontend on port 8080 and proxies `/api`, `/health`, and `/ready` |
| `prod-down` | Stop the production stack |
| `logs` | Follow dev stack logs |
| `migrate` | Run `prisma migrate deploy` in the dev backend container |
| `seed-dev` | Load the dev trip (Anu and Ravi, password `password123`, invite code `goa-weekend-dev`) |

## Environment variables

Set these in `docker/env/.env.dev`, `.env.test`, or `.env.prod`. Examples live next to those names.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NODE_ENV` | backend | `dev`, `test`, or `prod` |
| `POSTGRES_USER` | Postgres | Database user |
| `POSTGRES_PASSWORD` | Postgres | Database password |
| `POSTGRES_DB` | Postgres | Database name |
| `POSTGRES_PORT` | dev compose | Host port published for Postgres |
| `DATABASE_URL` | backend | Prisma connection string. The host name is the Compose service `db` |
| `BACKEND_PORT` | dev compose | Host port published for the API |
| `FRONTEND_PORT` | dev compose | Host port published for Vite |
| `FRONTEND_ORIGIN` | backend | Only this origin is allowed by CORS |
| `LOG_LEVEL` | backend | Pino level (`info`, `silent`, …) |
| `HTTP_PORT` | prod compose | Host port published for Nginx |
| `JWT_SECRET` | backend | HMAC secret for the session cookie. At least 16 characters |
| `AUTH_RATE_LIMIT_MAX` | backend | How many auth requests one client may make per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | backend | Auth rate-limit window in milliseconds |
| `SESSION_TTL_SECONDS` | backend | Session cookie lifetime |

Nothing in source hardcodes these values. Do not commit real `.env` files.

## Folder structure

```text
backend/     Fastify API, Prisma schema, unit tests
frontend/    Vite + React status page
docker/      Compose files and env examples
scripts/     reserved for repo scripts
.github/workflows/   placeholder (owner adds CI)
k8s/         placeholder (owner adds manifests)
terraform/   placeholder (owner adds Terraform)
```

The HTTP API is under `/api`. Money is integer minor units. GitHub Actions, Kubernetes, Terraform, and the product screens are still to come.
