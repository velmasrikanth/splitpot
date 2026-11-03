# SplitPot

SplitPot splits shared expenses for a party or a trip. Sign in, open a pot, add expenses, and settle who pays whom. The API and the screens both run through Docker Compose. Money is stored and calculated as integer minor units (paise or cents). The screens turn that into a currency string only when displaying it. Architecture, the stack, and how every test runs are in [docs/architecture.md](docs/architecture.md).

## Requirements

Docker with Compose v2, and `make`. Node and PostgreSQL are not installed on the host.

On this Windows laptop, Vagrant 2.4.7 is installed. `vagrant` is on PATH, but `make.exe` is not. It lives in `C:\Program Files\Vagrant\embedded\usr\bin`. Add that folder to the user PATH, then open a new terminal:

```powershell
$makeDir = 'C:\Program Files\Vagrant\embedded\usr\bin'
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path', "$userPath;$makeDir", 'User')
```

That folder was added on this machine. Close the terminal and open a new one before typing `make`. If Make still prints `bash.exe: warning: could not find /tmp, please create!`, create `C:\Program Files\Vagrant\embedded\tmp` from an Administrator PowerShell. The warning does not stop the command. If `make` is still not recognized, call it by full path:

```powershell
& "C:\Program Files\Vagrant\embedded\usr\bin\make.exe" dev-up
```

On a Linux server, `make` from the distro is enough. The same targets work there. A full Linux, Docker, and Kubernetes practice guide is in [docs/architecture.md](docs/architecture.md).

## Run the dev stack

From the repo root, with Docker Desktop (or the Docker engine) running:

```sh
make dev-up
```

- App: http://localhost:5173
- Backend health: http://localhost:3000/health
- Backend readiness (checks the database): http://localhost:3000/ready

The frontend dev server proxies `/api`, `/health`, and `/ready` to the backend. Source directories are bind-mounted, so edits reload.

```sh
make logs
make dev-down
```

`make dev-up` copies `docker/env/.env.dev.example` to `docker/env/.env.dev` when that file is missing. The same pattern applies to `.env.test` and `.env.prod`. Real env files are gitignored.

Optional demo data:

```sh
make seed-dev
```

That loads one trip, "Goa weekend", for `anu@example.com` and `ravi@example.com` (password `password123`), plus the guest Priya. The invite code is `goa-weekend-dev`. Seeding is skipped when Anu already exists.

## Walkthrough

Use two browsers, or one normal window and one private window. Amounts below are rupees; the API stores paise.

1. In the first browser, open http://localhost:5173, choose **Create an account**, and sign up as Anu (`anu.walk@example.com`, password at least 8 characters).
2. Choose **Create a pot**. Name it `Hill trip`, leave the type as **trip**, currency **INR**, and submit. Copy the invite link, then choose **Open the pot**.
3. In the second browser, open that invite link, choose **Sign up**, and create Ravi (`ravi.walk@example.com`). The app joins the trip and opens it.
4. Back as Anu, open **Expenses** and add four expenses. Leave both members checked.

| Description | Amount | Paid by | Split |
| --- | --- | --- | --- |
| Dinner | 1000 | Anu | Equal |
| Cab | 300 | Ravi | Exact: Anu 100, Ravi 200 |
| Snacks | 200 | Anu | Percentage: Anu 25, Ravi 75 |
| Tickets | 400 | Ravi | Shares: Anu 1, Ravi 3 |

The form shows the remaining amount or percent until the split matches the total, and **Add expense** stays disabled until it does. Each expense line names who paid and how it was split.

5. Open **Balances**. The total is ₹1,900.00. Anu gets back ₹450.00 (paid ₹1,200.00, share ₹750.00). Ravi owes ₹450.00 (paid ₹700.00, share ₹1,150.00). Food is ₹1,200.00, transport ₹300.00, and activities ₹400.00.
6. Open **Settle up**. It shows **Ravi pays Anu ₹450.00**. Choose **Mark as paid**.
7. The tab then says **All settled**, and the history lists that payment. The dashboard says **You are settled** for both people.

A signed-in person who is not a member of the trip sees "Group not found" if they open its address directly.

## Production

```sh
make prod-up
```

Nginx on http://localhost:8080 serves the built frontend and proxies `/api`, `/health`, and `/ready`. Before the API starts, a one-shot `migrate` container applies Prisma migrations and exits. Postgres data stays on the named volume `pgdata`. The API and the migrate container run as the non-root user `app`. Nginx is the unprivileged image.

The session cookie is `HttpOnly` and `SameSite=Lax`. It is marked `Secure` in production unless the proxy sends `X-Forwarded-Proto: http`, which the bundled Nginx does for this HTTP port. Put TLS in front of Nginx and the cookie becomes `Secure`.

```sh
make prod-down
```

## Make targets

| Target | What it does |
| --- | --- |
| `dev-up` | Build and start Postgres, the API, and the Vite app in the background |
| `dev-down` | Stop the dev stack |
| `test` | Run backend unit and integration tests against an ephemeral Postgres, then frontend tests, and remove the test stack. The make exit code is the first failing suite |
| `prod-up` | Build production images, migrate, and start Postgres, the API, and Nginx |
| `prod-down` | Stop the production stack |
| `logs` | Follow dev stack logs |
| `migrate` | Run `prisma migrate deploy` in the dev backend container |
| `seed-dev` | Load the Goa weekend trip when Anu does not already exist |

## Environment variables

Set these in `docker/env/.env.dev`, `.env.test`, or `.env.prod`. Examples live beside those files. Compose injects `HOST` (`0.0.0.0`) and `PORT` (`3000`) for the API; they are not in the example files.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NODE_ENV` | API | `dev`, `test`, or `prod` |
| `HOST` | API | Bind address. Compose sets `0.0.0.0` |
| `PORT` | API | Listen port inside the container. Compose sets `3000` |
| `POSTGRES_USER` | Postgres | Database user |
| `POSTGRES_PASSWORD` | Postgres | Database password |
| `POSTGRES_DB` | Postgres | Database name |
| `POSTGRES_PORT` | dev compose | Host port published for Postgres |
| `DATABASE_URL` | API, migrate | Prisma connection string. The host name is the Compose service `db` |
| `BACKEND_PORT` | dev compose | Host port published for the API |
| `FRONTEND_PORT` | dev compose | Host port published for Vite |
| `FRONTEND_ORIGIN` | API | The only browser origin allowed by CORS. Dev is `http://localhost:5173`. Prod is `http://localhost:8080` |
| `LOG_LEVEL` | API | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` |
| `HTTP_PORT` | prod compose | Host port published for Nginx |
| `JWT_SECRET` | API | HMAC secret for the session cookie. At least 16 characters |
| `AUTH_RATE_LIMIT_MAX` | API | How many signup or login attempts one client may make per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | API | Auth rate-limit window in milliseconds |
| `SESSION_TTL_SECONDS` | API | Session cookie lifetime |
| `VITE_PROXY_TARGET` | dev frontend | Where Vite proxies `/api`. Compose sets `http://backend:3000` |
| `CHOKIDAR_USEPOLLING` | dev frontend | `1` so file watching works through the bind mount |

Nothing in source hardcodes URLs, ports, or secrets. Do not commit real `.env` files.

## Folder structure

```text
backend/
  prisma/                  schema and SQL migrations
  src/domain/              split and settlement functions, no I/O
  src/http/                cookies, JWT, validation, errors
  src/routes/              HTTP handlers
  src/services/            use cases
  src/repositories/        Prisma queries
  src/integration/         API tests against Postgres
frontend/
  src/api/                 typed fetch client
  src/components/          shared controls
  src/features/            auth, dashboard, group, expenses
  src/lib/                 money formatting and split preview
docker/
  compose.base.yml         Postgres and API settings shared by every stack
  compose.dev.yml          bind mounts and hot reload
  compose.test.yml         ephemeral database and test commands
  compose.prod.yml         named database volume, one-shot migrate, Nginx
  env/                     .env.*.example files
Makefile
scripts/                   reserved for repo scripts
.github/workflows/         placeholder
k8s/                       placeholder
terraform/                 placeholder
```

## Left for CI, Kubernetes, and Terraform

These folders contain only a one-line note. The app stays stateless and configured by environment variables so they can be added without code changes.

- **GitHub Actions.** Build the images, run `make test`, and publish the production images. No workflow files are included.
- **Kubernetes.** Run the API and Nginx as separate deployments, the database with a persistent volume, and migrations as a Job that finishes before the API starts. Use `/health` for liveness and `/ready` for readiness. The API handles `SIGTERM` and logs JSON to stdout.
- **Terraform.** Provision the cluster, database, image registry, and DNS. No Terraform files are included.
