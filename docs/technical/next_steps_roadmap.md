# Entitle FEaaS — Implementation Roadmap & Milestones (Revised)

**Date:** January 15, 2026
**Status:** Implementation Phase (v1.0 locked)

---

## Context

The product vision, executive summary, enterprise pitch, and **revised MVP scope (v1.0)** are complete and locked.

The goal of this roadmap is to **translate the v1.0 MVP into an executable plan** that is:

* Buildable in ~9 weeks (includes internal admin tool)
* Architecturally correct
* Safe for alpha enterprise usage

This roadmap intentionally excludes post-MVP features.

---

## Guiding Rule for Execution

> **If a task does not directly support a correct, deterministic capability allow/deny decision, it does not belong in v1.0.**

---

## Phase 0 — Scope Lock & Preconditions (Week 0)

### Objectives

* Eliminate ambiguity before coding
* Prevent MVP creep

### Deliverables

* Finalized MVP scope (v1.0)
* Explicit v1.1 backlog (non-buildable items)
* Decision log for tech stack choices

### Exit Criteria

* No open scope questions
* All engineers aligned on what is *not* being built

---

## Phase 1 — Architecture & Foundations (Weeks 1–2)

### 1. Technical Architecture (Must Complete)

**Deliverables:**

* High-level system diagram (PDP-centric)
* Request lifecycle (auth → evaluation → response)
* Tenant resolution model (auth-derived)
* Failure modes (timeouts, retries, fallback behavior)
* Data isolation strategy (row-level, tenant-scoped)

**Explicitly Excluded:**

* Snapshot architecture
* Delegation models
* Multi-region design

**Exit Criteria:**

* Architecture reviewable by senior engineers
* Clear separation: decision vs enforcement

---

### 2. API Contract Definition

**Deliverables:**

* `/v1/evaluate` request & response schema
* Error model (timeouts, auth failure, invalid input)
* Header conventions
* Latency and timeout expectations

**Exit Criteria:**

* API contract frozen for v1.0
* SDK can be implemented without guesswork

---

### 3. Data Model & Persistence

**Deliverables:**

* PostgreSQL schema (DDL)
* Tables:

  * tenants
  * api_keys
  * capabilities
  * policies
  * policy_versions
* Indexing strategy

**Exit Criteria:**

* Schema reviewed for tenant isolation safety

---

## Phase 2 — Core Implementation (Weeks 3–5)

### 4. Policy Decision Point (PDP)

**Deliverables:**

* Policy storage and retrieval
* Deterministic evaluation algorithm
* Tenant-scoped execution context
* Structured decision logging

**Explicitly Excluded:**

* Usage enforcement
* Temporal logic
* Cross-scope inheritance

**Exit Criteria:**

* PDP returns correct decisions for all test cases

---

### 5. Authentication & Tenant Resolution

**Deliverables:**

* API key issuance and rotation
* Middleware for tenant resolution
* Environment separation (dev/prod)

**Exit Criteria:**

* Tenant identity never derived from request payload
* Zero cross-tenant data access in tests

---

## Phase 3 — SDK & Integration (Weeks 6–7)

### 6. Node.js SDK (v1 Only)

**Deliverables:**

* Typed SDK interface
* `/evaluate` client
* In-memory TTL caching
* Timeout & retry handling
* Shadow-mode support

**Explicitly Excluded:**

* Snapshot handling
* Multi-language SDKs
* Client-side enforcement logic

**Exit Criteria:**

* SDK usable with minimal configuration
* Integration achievable in <1 day

---

### 7. Internal Admin Tool (Optional)

**Deliverables:**

* Simple CRUD UI for tenant/capability/policy management
* Bulk import from YAML/JSON
* API key generation interface
* Internal use only (localhost/VPN access)

**Purpose:**
Accelerates alpha customer onboarding and support. Not customer-facing.

**Time:** 1-2 weeks (can be built in parallel with SDK)

**Exit Criteria:**

* Can onboard a tenant with 20+ capabilities in <5 minutes
* No need for manual API calls during customer setup

---

### 8. Reference Integration

**Deliverables:**

* Minimal demo backend
* Example capability checks
* Shadow-mode walkthrough

**Exit Criteria:**

* End-to-end flow demonstrable live

---

## Phase 4 — Alpha Readiness (Weeks 8-9)

### 9. Hardening & Validation

**Deliverables:**

* Basic load testing
* Latency measurements
* Error handling validation
* Security review (auth, isolation)

**Exit Criteria:**

* Stable behavior under expected alpha load
* No known data isolation issues

---

### 10. Alpha Onboarding

**Deliverables:**

* Integration guide
* Known limitations document
* Feedback capture loop

**Exit Criteria:**

* 2–3 alpha tenants integrated (shadow mode or partial enforcement)

---

## v1.0 Success Metrics

### Technical

* Correct allow/deny decisions
* P95 latency < 100ms
* Zero tenant data leakage

### Product

* Shadow-mode integration < 1 day
* Policy change effective without redeploy

### Business

* Architectural validation from alpha customers
* Clear signal to proceed to v1.1

---

## Explicitly Deferred to v1.1+

* Entitlement snapshots
* Audit query APIs
* Python SDK
* mTLS authentication
* Customer-facing admin console
* Usage limits (advisory)
* Delegated customer policies

**Note:** Internal admin tool (for Entitle team use) IS included in MVP to accelerate alpha onboarding.

---

## Resource Model (Lean)

* 1–2 backend engineers
* Optional SDK/DX support

No dedicated infra or frontend team required for v1.0.

---

## Next Immediate Actions (This Week)

1. Freeze API contract
2. Finalize PostgreSQL schema
3. Choose backend language
4. Create repo skeleton

---

## Final Note

This roadmap is intentionally conservative.

If Entitle cannot succeed with this minimal scope, adding features will not fix it.

**Build the PDP. Earn trust. Expand later.**
