# SplitPot

SplitPot splits shared expenses for a party or a trip. This branch is the Phase 0 scaffold: PostgreSQL, a Fastify backend, and a React page that calls the backend, all through Docker Compose.

## Requirements

Docker with Compose v2, and `make`. On Windows, `make` can be [ezwinports make](https://github.com/ezwinports/make) and the Makefile uses Git Bash (`C:\Program Files\Git\bin\bash.exe`). Node and PostgreSQL are not installed on the host.

## Run the dev stack

```sh
make dev-up
```

- App: http://localhost:5173
- Backend health: http://localhost:3000/health
- Backend readiness (checks the database): http://localhost:3000/ready

The frontend dev server proxies `/health` and `/ready` to the backend. The page shows both results. Source directories are bind-mounted, so edits reload.

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
| `test` | Run backend unit tests in a container against an ephemeral Postgres, then remove that stack |
| `prod-up` | Build and start the production images. Nginx serves the frontend on port 8080 and proxies `/health` and `/ready` |
| `prod-down` | Stop the production stack |
| `logs` | Follow dev stack logs |
| `migrate` | Run `prisma migrate deploy` in the dev backend container. There are no migrations in this phase |
| `seed-dev` | Run `npm run seed` in the dev backend container. The seed script arrives with the domain model |

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

## Intentionally not in this phase

Authentication, groups, expenses, settlement, and the product UI come next. GitHub Actions, Kubernetes, and Terraform stay empty on purpose.
