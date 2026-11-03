# MSYS Make already provides sh. Native Windows Make uses Git Bash.
ifeq ($(OS),Windows_NT)
  SH_EXISTS := $(shell sh -c "echo yes" 2>/dev/null)
  ifneq ($(SH_EXISTS),yes)
    SHELL := C:/PROGRA~1/Git/bin/bash.exe
    .SHELLFLAGS := --noprofile --norc -c
  endif
endif

.PHONY: dev-up dev-down test prod-up prod-down logs migrate seed-dev

DEV_FILES := -f docker/compose.base.yml -f docker/compose.dev.yml
TEST_FILES := -f docker/compose.base.yml -f docker/compose.test.yml
PROD_FILES := -f docker/compose.base.yml -f docker/compose.prod.yml

docker/env/.env.dev: docker/env/.env.dev.example
	cp docker/env/.env.dev.example docker/env/.env.dev

docker/env/.env.test: docker/env/.env.test.example
	cp docker/env/.env.test.example docker/env/.env.test

docker/env/.env.prod: docker/env/.env.prod.example
	cp docker/env/.env.prod.example docker/env/.env.prod

dev-up: docker/env/.env.dev
	docker compose --env-file docker/env/.env.dev $(DEV_FILES) up --build -d

dev-down:
	docker compose --env-file docker/env/.env.dev $(DEV_FILES) down

test: docker/env/.env.test
	docker compose --env-file docker/env/.env.test $(TEST_FILES) up --build --abort-on-container-exit --exit-code-from backend; \
	status=$$?; \
	docker compose --env-file docker/env/.env.test $(TEST_FILES) down -v; \
	if [ $$status -ne 0 ]; then exit $$status; fi; \
	docker compose --env-file docker/env/.env.test $(TEST_FILES) --profile frontend run --rm --build frontend-test

prod-up: docker/env/.env.prod
	docker compose --env-file docker/env/.env.prod $(PROD_FILES) up --build -d

prod-down:
	docker compose --env-file docker/env/.env.prod $(PROD_FILES) down

logs:
	docker compose --env-file docker/env/.env.dev $(DEV_FILES) logs -f

migrate: docker/env/.env.dev
	docker compose --env-file docker/env/.env.dev $(DEV_FILES) run --rm backend npx prisma migrate deploy

seed-dev: docker/env/.env.dev
	docker compose --env-file docker/env/.env.dev $(DEV_FILES) run --rm backend npm run seed
