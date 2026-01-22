# MVP Scope — Entitle FEaaS v1.0 (Revised)

**Target:** Alpha launch (8 weeks)
**Primary Goal:** Prove that commercial access policy can be safely externalized from application code and evaluated via Entitle in production-like conditions.

---

## Guiding Principle

> **Ship the smallest system that can make a correct, deterministic “allow / deny” decision for a capability, per tenant, with enterprise-safe boundaries.**

Anything that does not directly support this goal is deferred.

---

## Core Problem This MVP Must Solve

* SaaS teams hardcode feature gating and entitlements into business logic
* Changes require redeployments and risky code paths
* Entitle must prove it can become a trusted **Policy Decision Point (PDP)** without owning business behavior

This MVP exists to validate that trust.

---

## IN SCOPE — v1.0 (Must Ship)

### 1. Decision Evaluation API (Critical Path)

**Purpose:** Determine whether a principal is allowed to access a capability.

**Characteristics:**

* Stateless
* Deterministic
* Low latency
* Tenant context resolved via authentication (not request payload)

**API:**

```http
POST /v1/evaluate
```

**Request:**

```json
{
  "capability": "export-data",
  "principal": {
    "user_id": "user-123",
    "org_id": "org-456"
  },
  "context": {
    "environment": "production"
  }
}
```

**Response:**

```json
{
  "allowed": true,
  "reason": "policy_match",
  "policy_version": "v1"
}
```

Entitle evaluates policy only. Enforcement remains with the client.

---

### 2. Policy Management (Minimal, Declarative)

**Purpose:** Allow platform operators to define entitlement policy without code changes.

**Capabilities:**

* Create, update, deactivate policies
* Map plans → capabilities (simple allow lists)
* Environment scoping (dev / prod)
* Policy versioning (immutable history)

**Admin API (internal / alpha):**

```
POST   /v1/policies
GET    /v1/policies
PUT    /v1/policies/{id}
DELETE /v1/policies/{id}
```

**Policy Model (v1):**

```json
{
  "capability": "export-data",
  "allowed_plans": ["pro", "enterprise"]
}
```

No rule DSL. No scripting. No custom logic.

---

### 3. SDK (Single Language, Thin by Design)

**Purpose:** Provide a safe Anti-Corruption Layer for client systems.

**v1 SDK:** Node.js (TypeScript)

**Responsibilities:**

* Auth configuration
* Call `/evaluate`
* In-memory caching (short TTL)
* Timeouts & retries
* Shadow-mode support

**Explicitly NOT in SDK:**

* Policy logic
* Business rules
* Enforcement behavior

**Usage Example:**

```ts
if (entitle.can("export-data", { userId, orgId })) {
  exportData()
}
```

---

### 4. Authentication & Tenant Isolation (MVP Grade)

**Approach:**

* API key–based authentication
* One key per tenant per environment
* Tenant resolved from credentials, never from payload

**Guarantees:**

* Hard tenant isolation at data layer
* No cross-tenant visibility

> mTLS-based identity is explicitly deferred to post-MVP.

---

### 5. Structured Decision Logging (Internal)

**Purpose:** Debugging, trust-building, and correctness verification.

**Scope:**

* Log every decision evaluation
* Include tenant, capability, result, latency
* Retained as logs only (no query API in v1)

---

## OUT OF SCOPE — Explicitly Deferred

### ❌ Policy & Feature Complexity

* Usage limits and enforcement
* Trials and grace periods
* Kill switches
* Rollout percentages or segments
* Policy inheritance or delegation

### ❌ Enterprise & Platform Features

* mTLS / certificate auth
* RBAC & approvals
* Self-hosted or VPC deployments
* Multi-region
* SLAs

### ❌ Product & UX

* Admin web console
* Customer dashboards
* Visual analytics

### ❌ Integrations

* Billing systems (Stripe)
* Feature flag tools
* External policy engines

---

## Non-Functional Targets (MVP-Appropriate)

* **Latency:** P95 < 100ms
* **Availability:** Best effort (alpha)
* **Throughput:** Sufficient for alpha usage
* **Security:** TLS, input validation, secret rotation

No premature scaling targets.

---

## MVP Success Criteria

### Technical

* Correct allow/deny decisions in all tested scenarios
* Zero tenant data leakage
* SDK usable in shadow mode without enforcement

### Product

* Integration possible in <1 day
* Policy changes effective without redeploy
* Clear developer documentation

### Business

* 2–3 alpha customers running Entitle in shadow mode or partial enforcement
* Positive architectural feedback from engineering teams

---

## MVP Development Plan (8 Weeks)

### Weeks 1–2: Foundation

* Repo & service skeleton
* Auth & tenant resolution
* Database schema

### Weeks 3–4: Core PDP

* Policy storage
* Decision evaluation logic
* Logging

### Weeks 5–6: SDK & Integration

* Node.js SDK
* Caching & retries
* Example integration

### Weeks 7–8: Hardening & Alpha

* Load testing (basic)
* Bug fixes
* Alpha onboarding docs

---

## What This MVP Proves

* Entitlement logic can live outside business code
* Entitle can act as a safe, replaceable PDP
* Teams can adopt incrementally without risk

If these are proven, Entitle is viable.

---

## Post-MVP Direction (v1.1+)

* Entitlement snapshots
* Audit query APIs
* Python SDK
* mTLS authentication
* Usage limits (advisory)
* Basic admin UI

---

## Final Note

This MVP is intentionally boring.

Boring, predictable, and trustworthy is exactly what enterprise infrastructure needs to be.
