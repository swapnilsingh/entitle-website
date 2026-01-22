# Feature Enablement as a Service (FEaaS)

## 1. Purpose of This Document
This document defines **what we are building**, **why it exists**, and **what is explicitly in and out of scope**. Its goal is to align product, architecture, and go-to-market decisions early, and to ensure the product remains **DDD-safe, adoptable, and commercially viable**.

This is **not** a marketing document. It is a *product and architecture intent document*.

---

## 2. One‑Line Vision
> Externalize **commercial access policy and feature entitlements** from application code, without owning or leaking business logic.

---

## 3. Problem Statement
Modern SaaS products repeatedly re‑implement the same non-core logic:
- Feature gating based on plans
- Trial and grace period handling
- Usage limits and quotas
- Gradual rollouts and kill switches
- Plan-to-feature mapping

This logic:
- Is duplicated across services and frontends
- Becomes brittle when pricing or plans change
- Requires code changes for business decisions
- Blurs boundaries between billing, product, and core domain logic

Teams want to move fast **without rewriting access logic every time**.

---

## 4. What We Are Building

We are building a **Feature Enablement / Entitlements Platform** that acts as a:

- **Policy Decision Point (PDP)**
- **Commercial Access Control Layer**
- **Supporting / Generic Domain** (DDD-aligned)

It answers one fundamental question:

> *Is a given capability allowed for a given principal right now, and under what limits?*

It does **not** execute behavior. It only returns decisions.

---

## 5. Target Users (ICP)

### Primary Buyers
- CTOs / Heads of Engineering
- Principal / Staff Engineers
- Platform & Infra teams

### Target Companies
- B2B SaaS (Series A–C)
- API-first products
- AI / usage-based SaaS
- Multi-tenant platforms

### Explicitly Not Targeting (Initially)
- Consumer mobile apps
- Early-stage MVP-only startups
- Heavily regulated enterprise without MVP flexibility

---

## 6. Domain Positioning (DDD)

### Domain Classification
- **Supporting Domain** or **Generic Domain**
- Never a Core Domain

### Bounded Context Name
- *Feature Policy / Entitlements Context*

### Responsibility
- Evaluate **commercial access policies**
- Remain agnostic of business meaning

### Non-Responsibilities
- No workflow orchestration
- No business rule execution
- No product behavior control

---

## 7. Core Capabilities (IN SCOPE)

### 7.1 Entitlement Decision API (Core)
- Evaluate capability access
- Deterministic, low-latency
- Context-aware (user, org, environment)

### 7.2 Policy & Rule Management
- Define policies declaratively
- Versioned & auditable
- Environment-specific

### 7.3 Plan → Capability Mapping
- Decouple pricing plans from code
- Integrate with billing providers (input-only)

### 7.4 Trials, Grace & Expiry Handling
- Trial start/end
- Grace periods
- Soft vs hard expiration signals

### 7.5 Usage & Limit Evaluation (Advisory)
- Track usage counters
- Evaluate limits
- Emit signals (near-limit / exceeded)

### 7.6 Snapshots & Caching
- Precomputed entitlement snapshots
- Offline-safe behavior
- Edge/CDN compatible

### 7.7 Rollouts & Kill Switches
- Percentage rollouts
- Segment-based enablement
- Emergency disable

### 7.8 Audit & Decision Trace
- Why was access allowed/denied
- Policy + version traceability
- Support & compliance ready

---

## 8. Explicitly OUT OF SCOPE (Non‑Negotiable)

We will **not**:
- Execute business workflows
- Control feature behavior
- Implement pricing strategy
- Perform throttling or blocking
- Replace billing systems
- Perform analytics on product outcomes

Violation of this scope breaks DDD trust.

---

## 9. Integration Model (How Systems Use It)

- Client systems call FEaaS at **decision boundaries only**
- Integration via SDKs in an **Anti‑Corruption Layer**
- Enforcement always happens locally
- Configurable failure strategies (fail-open / fail-closed)

FEaaS is **consulted, not authoritative**.

---

## 10. Non‑Functional Requirements (Hard Constraints)

### Performance
- P95 < 10ms for decision API

### Reliability
- Highly available
- Cache-first design

### Safety
- Snapshot fallback
- Explicit staleness rules

### Security
- Strong isolation per tenant
- Fine-grained RBAC

---

## 11. Commercial Model (High Level)

- Subscription SaaS
- Pricing dimensions:
  - Monthly Active Users (MAU)
  - Policy evaluations
  - Environments

Enterprise add-ons:
- VPC / self-hosted
- Advanced RBAC
- SLA & support

---

## 12. Success Criteria

This product succeeds if:
- Teams remove entitlement logic from core services
- Pricing/plan changes require **no deployments**
- Architects accept it as a clean supporting domain
- Churn is low due to deep technical embedding

---

## 13. Client Onboarding Model

### 13.1 Onboarding Philosophy
Client onboarding must:
- Minimize coupling with client core domains
- Respect DDD boundaries
- Be incremental, reversible, and low-risk
- Require **no big-bang migration**

Onboarding is designed as **progressive adoption**, not replacement.

---

### 13.2 Onboarding Stages

#### Stage 0 — Conceptual Alignment (Pre-Technical)
**Artifacts delivered:**
- Domain boundary explanation (Entitlements vs Core Domain)
- Capability taxonomy template
- Decision-boundary checklist

**Goal:**
Align mental models before any code is written.

---

#### Stage 1 — Read-Only / Shadow Mode
**What happens:**
- Client integrates SDK in Anti-Corruption Layer
- FEaaS evaluates policies in parallel
- Client does NOT enforce decisions yet

**Artifacts delivered:**
- SDKs (Node, Python, Java)
- Sandbox environment
- Sample policies
- Decision comparison reports

**Goal:**
Build trust without production risk.

---

#### Stage 2 — Partial Enforcement
**What happens:**
- Select non-critical capabilities enforced
- Snapshots enabled
- Local overrides allowed

**Artifacts delivered:**
- Production credentials
- Snapshot configuration
- Failure-mode configuration (fail-open/closed)

**Goal:**
Demonstrate real value with controlled blast radius.

---

#### Stage 3 — Full Enforcement
**What happens:**
- FEaaS becomes authoritative PDP
- All commercial access decisions routed

**Artifacts delivered:**
- SLA agreement
- Audit & compliance reports
- Usage dashboards

**Goal:**
Operational embedding and long-term retention.

---

## 14. What We Sell (Artifacts)

### 14.1 Runtime Artifacts
- Low-latency Decision API
- Entitlement Snapshot Endpoints
- Usage Reporting Endpoints

These are **consumed by systems**, not humans.

---

### 14.2 Developer Artifacts
- SDKs (typed, versioned)
- Local policy simulators
- Integration examples
- Reference Anti-Corruption Layer adapters

---

### 14.3 Product & Ops Artifacts
- Admin Console (policy management)
- Audit logs & decision traces
- Environment separation (dev/staging/prod)

---

### 14.4 Governance & Trust Artifacts
- Policy version history
- Change approvals
- Rollback guarantees
- Deterministic evaluation guarantees

---

### 14.5 Commercial Artifacts
- Usage reports (MAU, evaluations)
- Billing transparency reports
- Entitlement state exports

---

## 15. What We Explicitly Do NOT Sell

- Business workflows
- Pricing optimization engines
- Feature behavior engines
- Domain-specific rule engines

These remain client-owned.

---

## 16. Guiding Principle (Final)

> We sell **capability decisions and trust**, not product behavior.

This principle governs onboarding, sales, and roadmap decisions.

