# Context Map — Entitle FEaaS

**Date:** January 15, 2026  
**Status:** Draft v1.0  
**Purpose:** High-level overview of bounded contexts, their relationships, and integration patterns.

---

## Overview

Entitle is designed as a **supporting/generic domain** that externalizes commercial access policy evaluation. The system is decomposed into distinct bounded contexts, each with clear responsibilities and well-defined boundaries.

---

## Visual Context Map

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Systems                           │
│                   (External Context)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Anti-Corruption Layer (SDK)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              ENTITLE PLATFORM                                │
│                                                              │
│  ┌────────────────┐    ┌──────────────────┐                │
│  │   Tenant       │    │   Policy         │                │
│  │   Identity     │◄───┤   Management     │                │
│  │   Context      │    │   Context        │                │
│  └────────┬───────┘    └──────┬───────────┘                │
│           │                    │                            │
│           │                    │                            │
│  ┌────────▼────────────────────▼───────────┐               │
│  │      Decision Evaluation                │               │
│  │      Context (Core PDP)                 │               │
│  └────────┬────────────────────────────────┘               │
│           │                                                 │
│           │                                                 │
│  ┌────────▼────────────────────┐  ┌──────────────────┐    │
│  │   Audit & Observability     │  │   Usage          │    │
│  │   Context                   │  │   Tracking       │    │
│  └─────────────────────────────┘  │   Context        │    │
│                                    │   (Future)       │    │
│                                    └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Bounded Context Catalog

### Core Contexts (MVP)

| Context | Type | Primary Responsibility | Status |
|---------|------|------------------------|--------|
| [Tenant Identity](tenant_identity_context.md) | Supporting | Authentication & tenant isolation | MVP |
| [Policy Management](policy_management_context.md) | Supporting | Policy definition & versioning | MVP |
| [Decision Evaluation](decision_evaluation_context.md) | Generic | Policy decision point (PDP) | MVP |
| [Audit & Observability](audit_context.md) | Supporting | Decision logging & compliance | MVP |

### Future Contexts

| Context | Type | Primary Responsibility | Status |
|---------|------|------------------------|--------|
| [Usage Tracking](usage_tracking_context.md) | Supporting | Usage counters & limit evaluation | v1.1+ |
| Delegation & Scoping | Supporting | Customer-managed policies | v2.0+ |
| Billing Integration | Supporting | Plan sync with billing systems | v2.0+ |

---

## Cross-Context Integration Patterns

### 1. Context Isolation

Each bounded context:
- Owns its data exclusively
- Exposes well-defined interfaces
- Never accesses another context's data directly

### 2. Anti-Corruption Layers

All cross-context communication happens via:
- Explicit APIs (internal or external)
- Domain events (future)
- Read-only projections (future)

### 3. Tenant Scope Propagation

- Tenant Identity Context resolves tenant from auth
- Tenant scope propagates to all downstream contexts
- No context re-derives tenant from request payload

---

## Context Boundaries — Critical Rules

### Decision Evaluation Context Must Never

- Own policy creation logic
- Perform authentication
- Execute business workflows
- Enforce decisions in client systems

### Policy Management Context Must Never

- Make runtime decisions
- Interpret principal context
- Enforce policies

### Audit Context Must Never

- Influence decision outcomes
- Block evaluation requests

---

## Integration with Client Systems

### Client System as External Context

Client systems are a separate bounded context with their own:
- Business logic and domain models
- Feature behavior and workflows
- Enforcement mechanisms

### Anti-Corruption Layer (SDK)

The SDK acts as the Anti-Corruption Layer:
- Translates client concepts to Entitle concepts
- Manages caching and retries
- Provides failure strategies
- Never leaks Entitle implementation details into client code

### Integration Principle

> **Entitle is consulted, not authoritative in client domain.**

Client systems:
- Call Entitle at decision boundaries
- Interpret and enforce decisions locally
- Maintain autonomy over business logic

---

## Strategic Design Decisions

### 1. Why Multiple Contexts?

Each context has distinct:
- Change drivers
- Stakeholders
- Lifecycle
- Data ownership

Combining them would create a single, complex bounded context vulnerable to erosion.

### 2. Why Tenant Identity is Separate

Authentication and tenant resolution are:
- Cross-cutting concerns
- Different change frequency than policies
- Security-critical and require isolation

### 3. Why Decision Evaluation is Stateless

Statelessness ensures:
- Horizontal scalability
- Deterministic behavior
- Simplicity of reasoning

### 4. Why Policy Management and Evaluation are Separate

- **Policy Management:** Write-heavy, admin-facing, versioned
- **Decision Evaluation:** Read-heavy, runtime-critical, low-latency

Different non-functional requirements demand separation.

---

## Context Ownership (Team Structure)

### MVP (Single Team)

All contexts owned by core team.

### Post-MVP (Potential Split)

- **Platform Team:** Tenant Identity, Decision Evaluation
- **Policy Team:** Policy Management, Audit
- **Integration Team:** SDKs, client onboarding

---

## Context Validation Checklist

For each context, ensure:

- ✅ Clear, single responsibility
- ✅ Ubiquitous language defined
- ✅ Data ownership explicit
- ✅ Integration points documented
- ✅ Anti-patterns explicitly ruled out
- ✅ Non-functional requirements stated

---

## Final Principle

> **Bounded contexts exist to prevent accidental coupling and preserve long-term architectural integrity.**

Every boundary in this document is intentional and defensible.

---

## Documentation Structure

Each bounded context has its own detailed document containing:
- Ubiquitous language definitions
- Detailed responsibilities and boundaries
- Data ownership and models
- API contracts and integration patterns
- Testing strategies
- Extensibility considerations

---

## Future Enhancements

For post-MVP capabilities and v2.0+ features, see:
- [Future Enhancements Overview](../future/IDEAS.md)
- [Usage Tracking Context](../future/usage_tracking_context.md) (detailed design for v1.1+)

---

## Next Steps

1. Review and validate MVP context documents
2. Define API contracts between contexts
3. Create detailed data models per context
4. Begin Week 1 implementation per roadmap

---

## Quick Links

- [Technical Roadmap](../technical/next_steps_roadmap.md)
- [MVP Scope](../technical/mvp_scope.md)
- [Product Vision](../sales/feature_enablement_as_a_service_scope_vision.md)
- [Future Ideas](../future/IDEAS.md)
