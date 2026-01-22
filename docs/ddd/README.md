# DDD Documentation — Entitle FEaaS

This directory contains Domain-Driven Design (DDD) documentation for the Entitle platform, defining bounded contexts, domain models, and integration patterns.

---

## Quick Start

1. **Start here:** [Context Map](context_map.md) — High-level overview of all bounded contexts
2. **Dive deep:** Individual context documents for detailed specifications

---

## Core Documents

### Strategic Design

**[Context Map](context_map.md)**  
Visual and tabular overview of all bounded contexts, their relationships, and integration patterns. Start here to understand the system architecture.

---

### Bounded Context Documents (MVP)

| Context | Document | Status |
|---------|----------|--------|
| Tenant Identity | [tenant_identity_context.md](tenant_identity_context.md) | MVP v1.0 |
| Policy Management | [policy_management_context.md](policy_management_context.md) | MVP v1.0 |
| Decision Evaluation | [decision_evaluation_context.md](decision_evaluation_context.md) | MVP v1.0 |
| Audit & Observability | [audit_context.md](audit_context.md) | MVP v1.0 |

---

### Future Contexts

Future contexts (e.g., Usage Tracking, Delegation & Scoping) are documented separately in [../future/](../future/) to maintain focus on MVP.

---

## What's in Each Context Document

Each bounded context document contains:

### 1. Purpose & Scope
- What problem does this context solve?
- Why is it a separate context?

### 2. Ubiquitous Language
- Domain-specific terminology
- Precise definitions of core concepts

### 3. Responsibilities
- What this context does (and doesn't do)
- Clear boundaries and anti-patterns

### 4. Domain Model
- Entities, value objects, aggregates
- Domain rules and invariants

### 5. Data Ownership
- Database schemas
- Tables and indexes
- Row-level security

### 6. API Contracts
- Public APIs (exposed to clients)
- Internal APIs (cross-context integration)
- Request/response formats

### 7. Integration Points
- Upstream dependencies
- Downstream consumers
- Anti-Corruption Layers (ACLs)

### 8. Non-Functional Requirements
- Performance targets
- Reliability guarantees
- Security considerations

### 9. Testing Strategy
- Unit, integration, performance tests
- Test scenarios and edge cases

### 10. Migration Path
- MVP scope
- Post-MVP evolution
- Long-term vision

---

## How to Use This Documentation

### For New Team Members

1. Read [Context Map](context_map.md) first
2. Focus on MVP contexts (skip Usage Tracking for now)
3. Understand integration patterns between contexts

### For Architects

Use these documents to:
- Validate system boundaries
- Review API contracts
- Ensure DDD principles are maintained

### For Engineers

- Reference ubiquitous language when naming code
- Follow data ownership rules strictly
- Respect context boundaries (no cross-context data access)

### For Product Managers

- Understand what each context delivers
- Know what's explicitly out of scope
- Plan features within context boundaries

---

## DDD Principles Applied

### 1. Bounded Contexts

Each context has:
- Clear boundaries (what it owns vs. what it doesn't)
- Own ubiquitous language
- Explicit integration points

### 2. Context Isolation

- Contexts never access each other's data directly
- All communication via APIs or events
- Anti-Corruption Layers protect boundaries

### 3. Domain Classification

- **Generic Domain:** Decision Evaluation (PDP pattern)
- **Supporting Domain:** All others (Tenant Identity, Policy Management, Audit, Usage Tracking)
- **Core Domain:** None (Entitle is infrastructure, not product logic)

### 4. Strategic Design

- Context Map visualizes relationships
- Integration patterns are explicit
- Dependencies flow in one direction (no circular)

---

## Context Relationships

### Dependency Graph

```
Client Systems (External)
    ↓
Tenant Identity Context ← (all contexts depend on this)
    ↓
Decision Evaluation Context → Policy Management Context
    ↓
Audit Context

Usage Tracking Context (future, parallel to Decision Evaluation)
```

**Rules:**
- Tenant Identity has no dependencies (leaf)
- Decision Evaluation depends on Tenant Identity + Policy Management
- Audit Context is write-only (never blocks other contexts)
- Usage Tracking is parallel (optional integration)

---

## Maintaining These Documents

### When to Update

- **Before implementing features:** Update context docs first
- **When boundaries change:** Requires architecture review
- **When adding new contexts:** Follow the template

### Change Control

- All changes require pull request review
- Architects must approve boundary changes
- Version history tracked at bottom of each doc

### Document Template

Use existing context documents as templates. Every context doc should include:
- Purpose, ubiquitous language, responsibilities
- Domain model, data ownership, API contracts
- Integration points, NFRs, testing strategy
- Migration path, open questions, change history

---

## Related Documentation

### MVP Focus
- [Technical Roadmap](../technical/next_steps_roadmap.md)
- [MVP Scope](../technical/mvp_scope.md)
- [Product Vision](../sales/feature_enablement_as_a_service_scope_vision.md)
- [Executive Summary](../sales/executive_summary_feature_enablement_as_a_service.md)

### Future Planning
- [Future Enhancements](../future/IDEAS.md) - Post-MVP strategic ideas
- [Usage Tracking Context](../future/usage_tracking_context.md) - Detailed v1.1+ design

---

## Questions or Feedback

For questions about bounded contexts or DDD decisions:
- **Architecture questions:** Review with principal engineer
- **Scope questions:** Refer to MVP scope document
- **Boundary disputes:** Escalate to architecture review

---

## Document Status

| Document | Last Updated | Status |
|----------|--------------|--------|
| Context Map | 2026-01-15 | Draft v1.0 |
| Tenant Identity Context | 2026-01-15 | Draft v1.0 |
| Policy Management Context | 2026-01-15 | Draft v1.0 |
| Decision Evaluation Context | 2026-01-15 | Draft v1.0 |
| Audit Context | 2026-01-15 | Draft v1.0 |
All documents currently in draft. Will be finalized after architecture review (Week 1).

**Note:** Future contexts and post-MVP features are documented in [../future/](../future/) to maintain focus on MVP execution.
