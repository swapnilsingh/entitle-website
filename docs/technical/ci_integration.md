# CI & Integration Tests — Recent Work

This document summarizes the CI changes, fixes, and how to run the service locally.

## What we changed

- **Image-based CI flow:** The CI builds a Docker image (`entitle:ci`) in the `go-build-test` job, `docker save`s it to `entitle-image.tar` and uploads it as the `api-image` artifact. The `integration` job downloads `api-image`, `docker load`s it and runs the container with `--network host` so the integration tests exercise the same runtime.
- **Deterministic DB seed:** Added `migrations/002_seed.sql`; CI applies migrations so integration tests run against known seed data.
- **Background audit insert fix:** `internal/handlers/evaluate.go` now uses a short background timeout context for decision-log DB inserts to avoid "context canceled" warnings seen in CI.
- **CI artifacts:** `api-image` (entitle-image.tar), `api-binary` (./bin/api), and `integration-diagnostics` (contains `diagnostics.txt` and `api.log`).

## How to run the service locally (quick)

1. Start Postgres:

```bash
docker run -d --name entitle-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=entitle -p 5432:5432 postgres:16
```

2. Build and run the API container locally:

```bash
docker build -t entitle:local -f docker/Dockerfile .
docker run --rm --network host -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/entitle" -e CI=true entitle:local
```

3. Health check:

```bash
curl -v http://127.0.0.1:8080/health
```

4. Run the integration test locally (requires `psql` and `go`):

```bash
# ensure migrations applied and test tenant seeded
psql "postgresql://postgres:postgres@localhost:5432/entitle" -f migrations/001_init.sql -f migrations/002_seed.sql
go test ./internal/integration -v
```

## Next steps

- Optionally publish image to GHCR from `go-build-test` and update deployment docs.
- Add `deployment.md` with architecture and production deployment instructions.
