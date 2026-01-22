# Technology Stack

**Decision Date:** 15 January 2026  
**Status:** Approved  
**Context:** 9-week MVP delivery, enterprise PDP, multi-language SDK support

---

## Executive Summary

**Backend Language:** Go 1.22  
**Rationale:** Lightweight (30MB containers), secure (minimal dependencies), fast (<10ms P95 latency achievable), lowest operational cost, excellent for stateless services.

**Trade-off Accepted:** Team must learn Go syntax if unfamiliar. Mitigated by Go's simplicity (25 keywords vs JavaScript's 60+) and excellent documentation.

---

## Core Stack

### Backend

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Language** | Go 1.22 | Memory-safe, compiled, 3-5x faster than Node.js, 10x fewer CVEs |
| **HTTP Router** | Chi v5 | Stdlib-based, <200 LOC, excellent middleware ecosystem, zero magic |
| **Database Driver** | pgx v5 | Fastest PostgreSQL driver for Go, connection pooling, prepared statements |
| **Query Builder** | sqlc v1.26 | SQL → type-safe Go, compile-time validation, zero runtime reflection |
| **Migrations** | golang-migrate | Idiomatic, supports up/down migrations, CI/CD friendly |
| **Validation** | go-playground/validator v10 | Struct tag validation, minimal boilerplate |
| **Config** | viper + godotenv | 12-factor app support, env vars + config files |

### Observability

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Logging** | slog (stdlib) | Structured JSON logging, zero dependencies, fast |
| **Metrics** | prometheus/client_golang | Industry standard, Kubernetes native |
| **Tracing** | OpenTelemetry (optional) | Defer to Week 4-5 unless critical path debugging needed |
| **Health Checks** | Custom `/health` endpoint | Simple liveness/readiness probes for K8s |

### Data Layer

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Database** | PostgreSQL 16 | Row-level security, JSONB for flexible policy storage, battle-tested |
| **Connection Pool** | pgx native pool | 10-50 connections per pod, health checks, auto-reconnect |
| **Caching** | sync.Map (MVP) | In-memory, thread-safe, zero latency. Defer Redis to v2. |
| **Cache Strategy** | Policy cache (5min TTL) | Reduces DB load, acceptable staleness for policy reads |

### Security

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **API Auth** | API Key (bcrypt, cost 12) | Simple, stateless, sufficient for MVP (mTLS in v2) |
| **Secrets** | Environment variables | Kubernetes Secrets injection, no secrets in code |
| **Rate Limiting** | Chi middleware | Per-tenant rate limits (100 req/s baseline) |
| **Input Sanitization** | validator + manual checks | Prevent injection, validate all external inputs |

### API Documentation

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Spec Format** | OpenAPI 3.1 | Industry standard, multi-SDK generation |
| **Generation** | swaggo/swag | Generate OpenAPI from Go code comments, single source of truth |
| **SDK Generation** | openapi-generator | Auto-generate Node.js, Python, Java, Go client SDKs |

### Testing

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Unit Tests** | stdlib `testing` | No framework needed, table-driven tests, fast |
| **Integration Tests** | testcontainers-go | Spin up real Postgres in Docker for tests |
| **API Tests** | stdlib `net/http/httptest` | Test HTTP handlers without starting server |
| **Coverage** | `go test -cover` | Built-in, 80%+ coverage target |

### Development Tools

| Tool | Purpose |
|------|---------|
| `golangci-lint` | Linting (50+ linters), enforce code quality |
| `gofmt` / `goimports` | Auto-formatting, import organization |
| `go mod tidy` | Dependency cleanup |
| `air` | Hot reload for local development |
| `make` | Build automation, common tasks |

### Containerization

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Base Image** | `golang:1.22-alpine` (build) | Small, secure, fast builds |
| **Runtime Image** | `gcr.io/distroless/static` | 2MB base, no shell, minimal attack surface |
| **Multi-stage Build** | Yes | Build in golang image, run in distroless (15-30MB final) |
| **Docker Compose** | Local dev | Postgres + API + optional admin UI |

---

## Week 0 Setup Checklist

### Repository Structure

```
entitle/
├── cmd/
│   ├── api/              # Main API server
│   └── migrate/          # Migration runner
├── internal/
│   ├── tenant/           # Tenant Identity Context
│   ├── policy/           # Policy Management Context
│   ├── decision/         # Decision Evaluation Context
│   ├── audit/            # Audit Context
│   ├── db/               # sqlc generated queries
│   └── middleware/       # Auth, logging, metrics
├── migrations/           # SQL migrations (numbered)
├── queries/              # SQL query definitions for sqlc
├── api/
│   └── openapi.yaml      # Generated OpenAPI spec
├── tests/
│   ├── integration/
│   └── fixtures/
├── scripts/
│   └── seed-dev-data.sh
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .air.toml             # Hot reload config
├── .golangci.yml         # Linter config
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### Dependency Installation

```bash
# Initialize Go module
go mod init github.com/yourorg/entitle

# Core dependencies
go get github.com/go-chi/chi/v5
go get github.com/jackc/pgx/v5
go get github.com/golang-migrate/migrate/v4
go get github.com/go-playground/validator/v10
go get github.com/spf13/viper
go get github.com/joho/godotenv

# Observability
go get github.com/prometheus/client_golang/prometheus
go get github.com/prometheus/client_golang/prometheus/promhttp

# Testing
go get github.com/testcontainers/testcontainers-go
go get github.com/testcontainers/testcontainers-go/modules/postgres

# Dev tools (installed globally, not in go.mod)
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install github.com/cosmtrek/air@latest
go install github.com/swaggo/swag/cmd/swag@latest
```

### Configuration Files

**`.air.toml` (Hot Reload)**
```toml
[build]
  cmd = "go build -o ./tmp/api ./cmd/api"
  bin = "./tmp/api"
  include_ext = ["go", "tpl", "tmpl", "html"]
  exclude_dir = ["tmp", "vendor", "tests"]
  delay = 1000
```

**`.golangci.yml` (Linting)**
```yaml
linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
    - gosec       # Security
    - gocritic    # Opinionated checks
    - revive      # Fast linter
    - sqlclosecheck
```

**`sqlc.yaml` (SQL → Go)**
```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "queries/"
    schema: "migrations/"
    gen:
      go:
        package: "db"
        out: "internal/db"
        emit_json_tags: true
        emit_prepared_queries: true
        emit_interface: false
        emit_exact_table_names: false
```

**`Makefile`**
```makefile
.PHONY: build run test lint migrate-up migrate-down sqlc docker-up docker-down

build:
	go build -o bin/api cmd/api/main.go

run:
	air

test:
	go test -v -cover ./...

lint:
	golangci-lint run

sqlc:
	sqlc generate

swagger:
	swag init -g cmd/api/main.go -o api/

migrate-up:
	migrate -path migrations -database "postgresql://user:pass@localhost:5432/entitle?sslmode=disable" up

migrate-down:
	migrate -path migrations -database "postgresql://user:pass@localhost:5432/entitle?sslmode=disable" down 1

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker build -t entitle-api:latest -f docker/Dockerfile .
```

---

## Multi-SDK Strategy

### OpenAPI-First Approach

1. **Week 0:** Write OpenAPI 3.1 spec manually or generate from Go code using swaggo
2. **Week 6:** Generate Node.js SDK using `openapi-generator-cli`
3. **Week 7:** Generate Python SDK
4. **Week 8-9:** Generate Java/Go SDKs (if time permits, else post-MVP)

### SDK Generation Command

```bash
# Node.js/TypeScript SDK
openapi-generator-cli generate \
  -i api/openapi.yaml \
  -g typescript-axios \
  -o sdks/typescript \
  --additional-properties=npmName=@entitle/sdk,supportsES6=true

# Python SDK
openapi-generator-cli generate \
  -i api/openapi.yaml \
  -g python \
  -o sdks/python \
  --additional-properties=packageName=entitle_sdk,projectName=entitle-sdk

# Java SDK
openapi-generator-cli generate \
  -i api/openapi.yaml \
  -g java \
  -o sdks/java \
  --additional-properties=groupId=com.entitle,artifactId=entitle-sdk
```

### SDK Publishing

- **Node.js:** npm registry (`@entitle/sdk`)
- **Python:** PyPI (`entitle-sdk`)
- **Java:** Maven Central (`com.entitle:entitle-sdk`)

---

## Development Workflow

### Day 1: Hello World

1. Initialize repo: `go mod init github.com/yourorg/entitle`
2. Create `cmd/api/main.go` with basic Chi router
3. Add `/health` endpoint
4. Run: `go run cmd/api/main.go`
5. Test: `curl http://localhost:8080/health`

### Week 1: Database + Auth

1. Write PostgreSQL schema in `migrations/001_init.sql`
2. Run migrations: `make migrate-up`
3. Write SQL queries in `queries/tenant.sql`
4. Generate Go code: `make sqlc`
5. Implement tenant auth middleware
6. Test: Integration test with testcontainers

### Week 2-3: Policy Management

1. Write policy domain logic in `internal/policy/`
2. Add SQL queries for policy CRUD
3. Implement HTTP handlers
4. Add Swagger comments: `@Summary`, `@Param`, `@Success`
5. Generate OpenAPI: `make swagger`

### Week 4-5: Decision Evaluation + Audit

1. Implement evaluation algorithm in `internal/decision/`
2. Add caching with `sync.Map`
3. Implement async audit logging
4. Add Prometheus metrics (request count, latency, cache hit rate)
5. Load test: `hey -n 10000 -c 100 http://localhost:8080/v1/evaluate`

### Week 6-8: SDK + Internal Admin UI

1. Generate SDKs from OpenAPI spec
2. Create example apps using Node.js SDK
3. Build internal admin tool (React + TypeScript)
4. Connect admin UI to backend API

### Week 9: Alpha Deployment

1. Build Docker image: `make docker-build`
2. Deploy to Kubernetes (or managed service)
3. Set up monitoring (Prometheus + Grafana)
4. Onboard 2-3 alpha customers

---

## Performance Targets

| Metric | MVP (Week 9) | Production (v2) |
|--------|--------------|-----------------|
| **P95 Latency** | <100ms | <10ms |
| **Throughput** | 500 req/s per pod | 5,000 req/s per pod |
| **Uptime** | 99% (2-3 day SLA) | 99.9% (8-hour SLA) |
| **Cache Hit Rate** | 80%+ | 95%+ |
| **Container Size** | <50MB | <30MB |
| **Cold Start** | <500ms | <200ms |

---

## Security Hardening Checklist

- [ ] All API inputs validated with `validator`
- [ ] SQL injection prevented (sqlc generates parameterized queries)
- [ ] API keys hashed with bcrypt (cost factor 12)
- [ ] Rate limiting enabled (100 req/s per tenant)
- [ ] TLS 1.3 required (no TLS 1.0/1.1)
- [ ] CORS configured (whitelist customer domains)
- [ ] Secrets in environment variables (never in code)
- [ ] Docker image runs as non-root user
- [ ] Distroless base image (no shell, no package manager)
- [ ] `golangci-lint` with `gosec` enabled
- [ ] Dependency scanning in CI (Dependabot or Snyk)
- [ ] PostgreSQL row-level security enforced

---

## Cloud-Native Compliance

### 12-Factor App Checklist

- [x] **I. Codebase:** Single repo, multiple deployments
- [x] **II. Dependencies:** `go.mod` explicit, vendored optional
- [x] **III. Config:** Environment variables via viper
- [x] **IV. Backing Services:** PostgreSQL as attached resource
- [x] **V. Build/Release/Run:** Strict separation (Docker multi-stage)
- [x] **VI. Processes:** Stateless (no local state, cache is advisory)
- [x] **VII. Port Binding:** Self-contained HTTP server (`:8080`)
- [x] **VIII. Concurrency:** Horizontal scaling via replicas
- [x] **IX. Disposability:** Fast startup (<500ms), graceful shutdown
- [x] **X. Dev/Prod Parity:** Docker Compose mirrors production
- [x] **XI. Logs:** Stdout (JSON), aggregated by log collector
- [x] **XII. Admin Processes:** One-off tasks via `cmd/migrate/`

---

## DDD Enforcement Strategy

### Bounded Context Isolation

Each context lives in its own package with clear boundaries:

```
internal/
├── tenant/
│   ├── domain.go         # Entities, value objects
│   ├── repository.go     # DB interface
│   ├── service.go        # Business logic
│   └── handler.go        # HTTP handlers
├── policy/
│   ├── domain.go
│   ├── repository.go
│   ├── service.go
│   └── handler.go
├── decision/
│   ├── domain.go
│   ├── service.go
│   └── handler.go
└── audit/
    ├── domain.go
    └── repository.go
```

### Import Rules (Enforced by Linter)

```yaml
# .golangci.yml
linters-settings:
  depguard:
    rules:
      main:
        deny:
          - pkg: "internal/policy"
            desc: "Decision context cannot import Policy context directly"
          - pkg: "internal/audit"
            desc: "No context can import Audit (write-only)"
```

### Context Communication

- **Decision → Tenant:** Via `TenantScope` value object (not direct import)
- **Decision → Policy:** Via interface, not concrete type
- **All → Audit:** Via event bus (async, fire-and-forget)

---

## Rationale for Key Choices

### Why Go over Node.js?

**Your priorities:**
- Fewer lines of code ✅ (30-40% less)
- Fast deployment ✅ (single binary, 30MB image)
- Secure/stable ✅ (10x fewer CVEs, no npm chaos)
- Easy to manage ✅ (minimal dependencies)
- Lightweight ✅ (3x less memory, 5x less CPU)
- Low latency ✅ (3-5x faster than Node.js)

**Trade-off:** Learning curve if team unfamiliar with Go. Mitigated by:
- Go's simplicity (easier than JavaScript in many ways)
- Excellent documentation (tour.golang.org, effective Go)
- Strong tooling (gofmt, go mod, built-in test runner)
- Clear error handling (no try/catch complexity)

### Why Chi over Gin/Echo/Fiber?

- Stdlib-compatible (uses `net/http` interfaces)
- Minimal abstraction (easy to understand)
- Excellent middleware ecosystem
- Not abandoned (active maintenance)

### Why sqlc over GORM?

- GORM is "magic" - violates DDD (Active Record pattern)
- sqlc generates code from SQL (explicit, no surprises)
- Compile-time safety (typos caught before runtime)
- Zero reflection overhead
- SQL is the source of truth (not Go structs)

### Why Distroless over Alpine?

- Smaller (2MB vs 5MB base)
- No shell (cannot `docker exec` for debugging, but that's a feature - no shell exploits)
- No package manager (no `apk add` - must be in build stage)
- Best security posture

### Why Defer Redis?

- In-memory cache sufficient for MVP (policy data <100MB per tenant)
- Stateless pods with same cache = no consistency issues
- Simplifies deployment (one less service)
- Can add Redis later with zero code changes (just swap `sync.Map` for Redis client)

---

## Alternatives Considered

### TypeScript (Node.js)

**Pros:** Team might know it, good ecosystem, SDK alignment  
**Cons:** 3x heavier, 3x slower, 10x more CVEs, node_modules hell  
**Verdict:** Good for MVP if team is fluent, but Go better aligns with "lightweight, secure, fast" priorities.

### Python (FastAPI)

**Pros:** Readable, good for data-heavy workloads  
**Cons:** 5x slower than Go, heavier containers, GIL limits concurrency  
**Verdict:** Not suitable for low-latency PDP.

### Rust

**Pros:** Fastest, most secure (memory-safe without GC)  
**Cons:** Steep learning curve, longer compile times, smaller ecosystem  
**Verdict:** Overkill for MVP. Consider for v3+ if performance becomes critical.

### Java (Spring Boot)

**Pros:** Enterprise-standard, excellent tooling  
**Cons:** 500MB+ containers, slow cold start, verbose  
**Verdict:** Too heavy for cloud-native PDP.

---

## Migration Path (If Stack Changes)

If Go proves unworkable (team cannot learn it in Week 0-1), fallback to:

**Fallback Stack:** TypeScript + Fastify + Prisma + PostgreSQL

**Migration cost:** 2-3 weeks of rework (but caught early in Week 0-1, so minimal waste).

**Decision point:** End of Week 1. If basic CRUD + auth not working in Go, pivot to TypeScript.

---

## Final Sign-Off

**Approved by:** [Team Lead]  
**Date:** 15 January 2026  
**Next steps:**
1. Clone repo skeleton
2. Run `make docker-up` to start local Postgres
3. Implement `/health` endpoint (Day 1 deliverable)
4. Implement tenant auth (Week 1 deliverable)

**Questions/Concerns:** Discuss in #engineering Slack channel.

---

## References

- [Effective Go](https://go.dev/doc/effective_go)
- [Go Standard Library](https://pkg.go.dev/std)
- [sqlc Documentation](https://docs.sqlc.dev/)
- [Chi Router](https://github.com/go-chi/chi)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [12-Factor App](https://12factor.net/)
- [OpenAPI Generator](https://openapi-generator.tech/)

