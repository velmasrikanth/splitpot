# SplitPot architecture

SplitPot is a small web app for a party or a trip. People with accounts share a pot, record who paid, and see the shortest list of payments that settles everyone. A pot can also include guests who do not have an account.

The app is a monorepo. Nothing in application code hardcodes a URL, port, or secret. Docker Compose is the only way the app, the database, and the tests are meant to run.

## Tech stack

| Piece | Choice | Role |
| --- | --- | --- |
| Runtime | Node.js 22 (bookworm-slim image) | API and frontend build |
| API | Fastify 5, TypeScript strict | HTTP server |
| Validation | Zod 3 | Every request body and the process environment |
| Database | PostgreSQL 16 | System of record |
| ORM | Prisma 6 | Schema, migrations, queries |
| Passwords | argon2 | Password hashes only; plaintext is never stored or logged |
| Sessions | HMAC-SHA256 JWT in an `HttpOnly` cookie | No session table. Cookie name is `token` |
| UI | React 18, Vite 6, TypeScript | Single-page app |
| Styling | Tailwind CSS 3 | Emerald and teal for primary actions, slate for surfaces, amber when someone owes, green when someone is owed |
| Routing | React Router 6 | Screens and the `?tab=` query on a pot |
| Server state | TanStack Query 5 | Fetch, cache, and refresh after a write |
| Forms | react-hook-form 7 and Zod | Signup, login, new pot, and the expense form |
| Icons | lucide-react | Category and navigation icons |
| Tests | Vitest 3 | Backend unit and integration tests; frontend component tests (jsdom, Testing Library) |
| Production web server | `nginxinc/nginx-unprivileged:1.27-alpine` | Serves the built UI and proxies the API |
| Package manager | npm, lockfiles committed | Major versions are pinned with `^`. Images do not use a `latest` tag |

## How a request moves

```text
Browser
  |  http://localhost:5173  (dev)  or  http://localhost:8080  (prod)
  v
Vite dev server  --or--  Nginx
  |  proxies /api, /health, /ready
  v
Fastify
  routes  ->  services  ->  repositories (Prisma)  ->  PostgreSQL
                |
                domain/   pure functions, no database
```

Dev bind-mounts `backend/` and `frontend/` into the containers, so a save reloads the API (`tsc --watch` and `node --watch`) and the Vite page. Production images contain the compiled API and the built `frontend/dist`. They do not mount source.

Compose is split so the three environments share one base file:

| File | What it adds |
| --- | --- |
| `docker/compose.base.yml` | Postgres 16 and the API environment, including the database health check |
| `docker/compose.dev.yml` | Published ports, source bind mounts, named volumes for `node_modules`, hot reload |
| `docker/compose.test.yml` | Postgres on a tmpfs (thrown away), backend test command, frontend tests behind the `frontend` profile |
| `docker/compose.prod.yml` | Named volume `pgdata`, one-shot `migrate` service, Nginx on `HTTP_PORT` |

Project names are `splitpot-dev`, `splitpot-test`, and `splitpot-prod`, so the three stacks do not share containers.

## Backend

Layers, and they stay in this order:

1. `src/routes/` reads the HTTP request, checks the caller, and returns JSON.
2. `src/services/` applies the use-case rules (membership, who may edit, closed pots).
3. `src/repositories/` is the only place that calls Prisma.
4. `src/domain/` is pure. `splits.ts` divides an amount. `balances.ts` turns expenses and settlements into nets. `settlement.ts` turns nets into transfers. No file in `domain/` imports Prisma or Fastify.

`src/http/` holds the cookie, the JWT, Zod schemas, the error shape, and the auth rate limiter. `src/config.ts` parses the environment and refuses to start when a required variable is missing or `JWT_SECRET` is shorter than 16 characters.

Errors always look like this:

```json
{ "error": { "code": "NOT_FOUND", "message": "Group not found" } }
```

A person who is not a member of a pot gets `404 NOT_FOUND`, not `403`, so the response does not reveal that the pot exists.

### Process

`src/index.ts` loads config, connects Prisma, and listens. Logs are JSON on stdout. `SIGTERM` and `SIGINT` close the HTTP server, disconnect Prisma, and exit 0. `/health` is liveness and does not touch the database. `/ready` runs `SELECT 1` and returns 503 when the database is down. Both sit outside the `/api` prefix.

### Auth

Signup and login hash or verify the password with argon2, then set a cookie:

- Name `token`, `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Max-Age` is `SESSION_TTL_SECONDS` (seven days in the examples)
- `Secure` is added in production unless the proxy sends `X-Forwarded-Proto: http`. The bundled Nginx sends that on port 8080, so a local production stack can stay signed in. HTTPS in front of Nginx makes the cookie `Secure`.
- Logout clears the cookie. The JWT itself is still valid until it expires if a client sends it again.

Signup and login are rate-limited in memory (`AUTH_RATE_LIMIT_MAX` per `AUTH_RATE_LIMIT_WINDOW_MS`, keyed by client address). The limiter resets when the process restarts. CORS allows only `FRONTEND_ORIGIN`, with credentials.

### Money

Amounts are integers in minor units. INR, USD, EUR, and GBP all use a scale of 100, so ₹12.50 is `1250`. There is no floating-point money. The UI converts a decimal string to minor units with integer arithmetic and formats with `Intl.NumberFormat` only at the edge.

A split must sum to the expense exactly. For equal, percentage, and share splits, any leftover minor units go one at a time to members in sorted member-id order. Percentages are basis points: 100% is `10000`, and `33.34%` is `3334`.

Net for a member is `paid - share`. A settlement from A to B increases A's net and decreases B's. Suggested transfers pair the largest creditor with the largest debtor. Ties break by member id. Recording every suggestion brings every net to zero.

A closed pot is read-only. The owner can reopen it. Currency cannot change after any expense or settlement exists. An expense can be edited or deleted by its creator or the pot owner. A member cannot be removed when an expense or settlement still refers to them, and the owner's membership cannot be removed.

### Data model

```text
User 1---* Member *---1 Group 1---* Expense 1---* ExpenseSplit
                         |                |
                         *--- Settlement  *--- Member (payer, and each split line)
```

- `User`: email, name, argon2 password hash.
- `Group`: name, `party` or `trip`, currency, open or closed, invite code, optional start and end dates, creator.
- `Member`: a user or a guest (`userId` null) inside one group, with the name shown on expenses.
- `Expense`: description, `amountMinor`, category, calendar date, payer, split type, creator.
- `ExpenseSplit`: one member's `shareMinor`. The rows for an expense sum to `amountMinor`.
- `Settlement`: from member, to member, `amountMinor`, date.

### HTTP API

All of these are under `/api` except health.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/signup` | Public. Body: email, password (min 8), name |
| POST | `/api/auth/login` | Public. Body: email, password |
| POST | `/api/auth/logout` | Signed in. `204`, cookie cleared |
| GET | `/api/auth/me` | Signed in |
| GET | `/api/groups` | Pots the caller belongs to. No totals |
| POST | `/api/groups` | Creates a pot and an owner membership |
| POST | `/api/groups/join` | Body: `inviteCode`. Joining twice is safe |
| GET | `/api/groups/:id` | Members only |
| PATCH | `/api/groups/:id` | Owner may rename or set `open` / `closed` |
| POST | `/api/groups/:id/members` | Add a guest by `displayName` |
| DELETE | `/api/groups/:id/members/:memberId` | Remove a member who is not referenced and is not the owner |
| GET/POST | `/api/groups/:id/expenses` | List or create |
| PATCH/DELETE | `/api/groups/:id/expenses/:expenseId` | Creator or owner |
| GET | `/api/groups/:id/summary` | Total, per-member paid/share/net, category totals, transfers, `settled` |
| GET/POST | `/api/groups/:id/settlements` | History, or record a payment |
| DELETE | `/api/groups/:id/settlements/:settlementId` | Undo a payment while the pot is open |
| GET | `/health`, `/ready` | Probes |

An expense body is one of four shapes, chosen by `splitType`:

- `equal`: `memberIds`
- `exact`: `lines[{ memberId, amountMinor }]`
- `percentage`: `lines[{ memberId, basisPoints }]`
- `shares`: `lines[{ memberId, shares }]`

The group list does not include money. The dashboard asks `/summary` once per pot and reads "your balance" from the member row whose `userId` is the signed-in user.

## Frontend

`src/api/client.ts` is the only `fetch`. Components never call the network themselves. Cookies are sent with `credentials: "include"`. A non-OK response becomes an `ApiError` with the server `code` and `message`.

Screens live under `src/features/`:

| Folder | Screens |
| --- | --- |
| `auth` | Landing, login, signup. A `next` query may only be a same-site path |
| `dashboard` | One card per pot: type icon, initials, total spent, your balance |
| `groups` | Create a pot and show the invite link. Join by `/join/:code` |
| `group` | Tabs Expenses, Balances, Settle up, Members |
| `expenses` | Add and edit sheet. Amount first, then payer, members, split type, live preview |
| `shell` | Header, theme toggle, logout, tab bar |

The pot tabs are `?tab=expenses|balances|settle|members`. An open pot shows a floating **Add expense** button. On a phone the form is a bottom sheet; from the `md` breakpoint up it is a dialog. Exact and percentage splits show the remainder and keep submit disabled until the lines match. The preview uses the same integer split function as the API (`src/lib/splits.ts`). Theme is `light` or `dark` in `localStorage` key `splitpot-theme`, or the system preference when nothing is stored.

## Environments and Make

Copy-on-first-use: `make dev-up`, `make test`, and `make prod-up` copy `docker/env/.env.*.example` to the real file when it is missing. Real env files are gitignored.

| Target | Result |
| --- | --- |
| `make dev-up` | Postgres, API on port 3000, Vite on port 5173 |
| `make dev-down` | Stops the dev stack. The named database volume is kept |
| `make test` | Backend tests against a throwaway Postgres, then frontend tests. Non-zero if either suite fails |
| `make prod-up` | Migrate, then API and Nginx on port 8080 |
| `make prod-down` | Stops production. The `pgdata` volume is kept |
| `make logs` | Follows the dev stack |
| `make migrate` | `prisma migrate deploy` in the dev API container |
| `make seed-dev` | Inserts the Goa weekend trip when `anu@example.com` is not already there |

`make seed-dev` creates Anu and Ravi with password `password123`, the guest Priya, and six expenses. The invite code is `goa-weekend-dev`.

Production migration is a separate container (`Dockerfile` target `migrate`). It runs `prisma migrate deploy` as user `app` and exits. The API does not migrate on startup. Both the API and Nginx run as non-root.

Variables are listed in the root [README](../README.md). The API also reads `HOST` and `PORT`, which Compose sets to `0.0.0.0` and `3000`.

## Run it on this Windows laptop

Docker Desktop has to be running. Open PowerShell in the repo root (`C:\Data_Drive\Devops\V-Repos\splitpot`).

```powershell
make dev-up
```

Then open http://localhost:5173. The API is http://localhost:3000/health and http://localhost:3000/ready. The first start after a rebuild compiles the API inside the container, so wait until those URLs return `{"status":"ok"}` before refreshing the page.

| Command | What you get |
| --- | --- |
| `make dev-up` | Postgres, API, and the Vite app |
| `make dev-down` | Stops those containers. The database volume stays |
| `make logs` | Follows container logs. Ctrl+C leaves the stack running |
| `make seed-dev` | Anu and Ravi, password `password123`, invite `goa-weekend-dev` |
| `make test` | Backend tests, then frontend tests |
| `make prod-up` | Production images on http://localhost:8080 |
| `make prod-down` | Stops the production stack |

`make` is `C:\Program Files\Vagrant\embedded\usr\bin\make.exe`. Vagrant's own `bin` folder is on the system PATH, and that folder does not contain `make`. The `usr\bin` folder has to be on the user PATH as well. After adding it, close the terminal and open a new one. An already open terminal keeps the old PATH, so it still says `make` is not recognized.

`make dev-down` can also print this and still stop the containers:

```text
bash.exe: warning: could not find /tmp, please create!
```

Vagrant's Make shells out to Git Bash, and that Bash looks for a Unix `/tmp`. The recipe after the warning is what matters. `make dev-up` prints the same line, then builds and starts the stack.

If `make` is not on `PATH`:

```powershell
& "C:\Program Files\Vagrant\embedded\usr\bin\make.exe" dev-up
& "C:\Program Files\Vagrant\embedded\usr\bin\make.exe" dev-down
```

## Run and test on a Linux server

This is the same app with the host's Docker engine instead of Docker Desktop. Install Docker Engine and the Compose plugin (`docker compose version` must work). `make` is optional. GNU Make from the distro (`sudo apt install make` on Debian or Ubuntu) runs the Makefile with no `/tmp` warning. You can also call Compose yourself. Nothing else is installed on the server: no Node, no Postgres.

Clone the repo on the server and work from that directory.

### Dev stack

Use this when you want hot reload and a published API port. It bind-mounts the source, so the server needs the git checkout, not only images.

```sh
cp -n docker/env/.env.dev.example docker/env/.env.dev
docker compose --env-file docker/env/.env.dev \
  -f docker/compose.base.yml -f docker/compose.dev.yml \
  up --build -d
```

`cp -n` does not overwrite an env file you already edited. Check:

```sh
docker compose --env-file docker/env/.env.dev \
  -f docker/compose.base.yml -f docker/compose.dev.yml ps
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:3000/ready
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5173/
```

`/health` and `/ready` return `{"status":"ok"}`. The page returns `200`. From another machine, open `http://SERVER:5173` only after `FRONTEND_ORIGIN` in `.env.dev` is that exact origin. CORS rejects every other origin. Stop with:

```sh
docker compose --env-file docker/env/.env.dev \
  -f docker/compose.base.yml -f docker/compose.dev.yml down
```

`make dev-up` and `make dev-down` are those two commands.

### Tests

The test stack is disposable. Postgres data is a tmpfs, and `down -v` removes it. Run this on the Linux server the same way as on the laptop. The exit code is the test result.

```sh
cp -n docker/env/.env.test.example docker/env/.env.test
docker compose --env-file docker/env/.env.test \
  -f docker/compose.base.yml -f docker/compose.test.yml \
  up --build --abort-on-container-exit --exit-code-from backend
status=$?
docker compose --env-file docker/env/.env.test \
  -f docker/compose.base.yml -f docker/compose.test.yml down -v
test $status -eq 0
docker compose --env-file docker/env/.env.test \
  -f docker/compose.base.yml -f docker/compose.test.yml \
  --profile frontend run --rm --build frontend-test
```

The first Compose command builds the API image, starts Postgres, applies `backend/prisma/migrations`, and runs `npm test`. You should see 33 backend tests pass and the backend container exit 0. The second command builds the frontend image and runs 8 Vitest tests. `make test` is this sequence. The frontend service uses a Compose profile so it does not start during the API run and steal the exit code.

### Production-shaped stack

This is the one to practice on a server. Images are self-contained. Source is not mounted. Nginx is the only published port.

```sh
cp -n docker/env/.env.prod.example docker/env/.env.prod
```

Edit `docker/env/.env.prod` before the first start:

- `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must match, and must not stay `change-me` on a shared server.
- `JWT_SECRET` must be at least 16 characters and must not stay `change-me-prod-secret`.
- `FRONTEND_ORIGIN` must be the URL you type in the browser, for example `http://203.0.113.10:8080`. `localhost` is wrong when you open the app from another machine.
- `HTTP_PORT` is the host port mapped to Nginx's 8080.

```sh
docker compose --env-file docker/env/.env.prod \
  -f docker/compose.base.yml -f docker/compose.prod.yml \
  up --build -d
```

What comes up, in order:

1. `db` — `postgres:16-alpine`, data on the named volume `pgdata`.
2. `migrate` — backend image target `migrate`, user `app`, runs `prisma migrate deploy`, exits 0. It does not stay running.
3. `backend` — backend image target `runtime`, user `app`, starts only after migrate succeeded. No host port. Other containers reach it as `backend:3000`.
4. `frontend` — Nginx unprivileged image, host `HTTP_PORT` to container 8080. It proxies `/api/`, `/health`, and `/ready` to `http://backend:3000`.

Checks:

```sh
docker compose --env-file docker/env/.env.prod \
  -f docker/compose.base.yml -f docker/compose.prod.yml ps
docker logs splitpot-prod-migrate-1
curl -sS http://127.0.0.1:8080/health
curl -sS http://127.0.0.1:8080/ready
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
docker inspect --format '{{.Config.User}}' splitpot-prod-backend-1
```

Migrate logs end with `All migrations have been successfully applied.` Health and ready return ok. The page returns 200. The API user is `app`. Sign up in the browser at `http://SERVER:8080` and add an expense. That proves the cookie and the `/api` proxy, not only the probes.

Graceful shutdown, the same signal Kubernetes sends:

```sh
docker kill --signal=SIGTERM splitpot-prod-backend-1
docker logs splitpot-prod-backend-1 --tail 5
```

The log line is `shutting down` and the exit code is 0. Compose restarts the API because `restart: unless-stopped` is set. Stop the whole stack with `down`. Add `-v` only when you mean to delete `pgdata`.

```sh
docker compose --env-file docker/env/.env.prod \
  -f docker/compose.base.yml -f docker/compose.prod.yml down
```

`make prod-up` and `make prod-down` are those commands. On Linux they behave the same as on the laptop.

## What maps to Kubernetes

`k8s/` is still only a placeholder README. The manifests are left for you to write as practice. The running shape is already fixed by Compose, so a cluster uses the same images and the same environment variables.

| Compose service | Kubernetes object | Notes |
| --- | --- | --- |
| `db` | StatefulSet or Deployment, Service `db:5432`, PersistentVolumeClaim | Same `postgres:16-alpine`. Put the password in a Secret. The volume replaces `pgdata` |
| `migrate` | Job, `restartPolicy: Never` | Image target `migrate`, command `npx prisma migrate deploy`. The API must not start until this Job succeeds |
| `backend` | Deployment, ClusterIP Service named `backend` port 3000 | Non-root. Liveness `GET /health`. Readiness `GET /ready`. No public port. `terminationGracePeriodSeconds` at least 20 so `SIGTERM` can finish |
| `frontend` | Deployment, Service NodePort or LoadBalancer port 8080 | Nginx image. The config calls `http://backend:3000`, so the API Service has to be named `backend` unless you change `frontend/nginx.conf` |

Build and push the two runtime images from the Linux server (or from CI later):

```sh
docker build -f backend/Dockerfile --target runtime -t your-registry/splitpot-api:0.1.0 backend
docker build -f backend/Dockerfile --target migrate -t your-registry/splitpot-migrate:0.1.0 backend
docker build -f frontend/Dockerfile --target runtime -t your-registry/splitpot-web:0.1.0 frontend
```

The API Deployment gets `NODE_ENV=prod`, `DATABASE_URL` with host `db`, `FRONTEND_ORIGIN` set to the URL users open, and a real `JWT_SECRET`. Logs are already JSON on stdout. Put TLS on the ingress. Nginx sets `X-Forwarded-Proto` from its own scheme, so the session cookie is `Secure` only when Nginx itself sees HTTPS. An ingress that terminates TLS and forwards HTTP will leave the cookie non-Secure until Nginx is changed to trust the ingress header.

No Helm chart and no Terraform are in the repo. Those are the next practice pieces, after a manifest you wrote brings up `/health`, `/ready`, and a signup on the cluster.

## How to test

Docker must be running. From the repo root:

```sh
make test
```

That is the suite that has to pass. It does two steps and keeps the first failure:

1. `docker compose` project `splitpot-test` starts Postgres on an empty tmpfs, applies `backend/prisma/migrations`, and runs `npm test` in the API image. `--exit-code-from backend` makes the Make status that container's status. The stack is then removed with `down -v`.
2. If the API tests passed, `docker compose run --rm --build` with profile `frontend` runs `npm test` in the frontend image. That service is not part of the default `up`, so it cannot race the API tests.

No Node or Postgres install is required on the host. `make` on this Windows machine is `C:\Program Files\Vagrant\embedded\usr\bin\make.exe` when `make` is not on `PATH`.

### Backend tests (33)

| File | What it locks down |
| --- | --- |
| `src/domain/splits.test.ts` | Equal, exact, percentage, and share splits, including remainder minor units |
| `src/domain/settlement.test.ts` | Equal nets, uneven nets, rounding, already settled, one person owes everyone, 10 or more members |
| `src/http/jwt.test.ts` | Sign and verify, and reject a tampered token |
| `src/http/cookies.test.ts` | `Secure` only in production, and not when the proxy says `http` |
| `src/config.test.ts` | Env parsing and rejection of a bad config |
| `src/app.test.ts` | `/health`, `/ready` when the database check fails, the error shape, and a missing route |
| `src/integration/api.test.ts` | Real Postgres: signup, login, logout, rate limit, non-member `404`, expense validation, the worked example below, closed pots, guests |

Worked example inside `api.test.ts`, in minor units:

- A pays 4000, split equally across A, B, C, D.
- B pays 1500, split equally across B and C.
- C pays 600, split equally across A, C, and D.
- Nets: A +2800, B −250, C −1350, D −1200.
- Transfers: C pays A 1350, D pays A 1200, B pays A 250.
- After those settlements are stored, every net is 0 and the summary says settled.

### Frontend tests (8)

| File | What it locks down |
| --- | --- |
| `src/lib/money.test.ts` | Minor units to a decimal string and back, without floating-point parsing |
| `src/features/expenses/ExpenseForm.test.tsx` | Equal preview, exact remainder, exact lines that add up, percentage remainder. Submit stays disabled while the remainder is wrong |
| `src/features/group/BalanceList.test.tsx` | Positive balance is green ("gets back"), negative is amber ("owes") |

The tests assert decimal strings and color classes, not a currency glyph, because `Intl` output depends on the container locale.

### Manual pass

The click-by-click script (two accounts, one trip, four split types, balances, **Mark as paid**, **All settled**) is in the root README under "Walkthrough". Dev is http://localhost:5173. Production is the same UI on http://localhost:8080.

After `make dev-up` or `make prod-up`:

```sh
curl -sS http://localhost:3000/health
curl -sS http://localhost:3000/ready
curl -sS http://localhost:8080/health
curl -sS http://localhost:8080/ready
```

Dev health is also proxied at http://localhost:5173/health.

## Why the `backend` folder can look red in the editor

The editor type-checks on the host. Dev Compose mounts a Docker volume on `/app/node_modules`, so the packages the container uses are not the `backend/node_modules` folder you see in the repo. That host folder is gitignored and can contain only a lockfile stub. TypeScript then reports `Cannot find module 'fastify'` (and the same for Prisma, Zod, and Node types) on every backend file, and the folder turns red.

The API is fine when `make test` or `make dev-up` succeeds. Those commands use the image and the volume, not the host folder.

To clear the editor errors, the host folder needs a real install. From a running dev stack this copies the container's packages out:

```sh
docker run --rm -v splitpot-dev_backend_node_modules:/from -v "%cd%/backend/node_modules:/to" alpine sh -c "cp -a /from/. /to/"
```

Reload the editor window afterward. Do not commit `node_modules`. The container keeps using its own volume, so this copy does not change how the app runs.

## Left outside this repo

`.github/workflows/`, `k8s/`, and `terraform/` each contain a one-line note and nothing else. The section above is the map for writing those yourself. The API is stateless, configured only by environment variables, and already exposes `/health`, `/ready`, JSON logs, and `SIGTERM` handling so a workflow, a chart, or Terraform can wrap it without application changes.
