# Decision Evaluation Context (Core PDP)

**Domain Classification:** Generic Domain (Policy Decision Point Pattern)  
**Owner:** Platform Team  
**Status:** MVP v1.0

---

## Purpose

The Decision Evaluation Context is the **heart of Entitle**. It implements the Policy Decision Point (PDP) pattern, evaluating whether a principal is allowed to access a capability based on active policies. This context is stateless, deterministic, and optimized for low-latency runtime decisions.

---

## Ubiquitous Language

### Core Concepts

**Principal**  
The entity requesting access, typically composed of a user identifier and an organizational context (e.g., `userId` + `orgId`).

**Evaluation Request**  
A query asking: "Can this principal access this capability right now?"

**Decision**  
The deterministic result of an evaluation, either `allow` or `deny`, accompanied by reasoning.

**Evaluation Context**  
Additional contextual information provided with a request (environment, metadata) that may influence the decision.

**Policy Match**  
The process of determining which policy applies to a given capability and whether the principal satisfies its conditions.

**Decision Rationale**  
An explanation of why a decision was made (e.g., "policy_match", "no_policy_found", "plan_not_allowed").

---

## Responsibilities

### Primary

1. **Receive evaluation requests** from client systems via SDK
2. **Resolve applicable policies** for the requested capability
3. **Evaluate principal context** against policy rules
4. **Return deterministic decisions** (allow/deny + rationale)
5. **Ensure tenant isolation** in all evaluations
6. **Log all decisions** to Audit Context

### Secondary

7. Provide decision latency metrics
8. Support shadow-mode evaluation (for testing)
9. Handle policy cache warming

---

## What This Context Does NOT Do

### Explicitly Out of Scope

- ❌ Enforce decisions (client responsibility)
- ❌ Manage or store policies (Policy Management Context)
- ❌ Authenticate requests (Tenant Identity Context)
- ❌ Track usage or consume quotas (Usage Tracking Context - future)
- ❌ Execute workflows or side effects
- ❌ Make business logic decisions

**Critical Boundary:**  
This context answers "Is access allowed?" — not "What should happen next?"

---

## Domain Model

### Value Objects

#### EvaluationRequest

```typescript
interface EvaluationRequest {
  capability: CapabilityName
  principal: Principal
  context?: EvaluationContext
}

interface Principal {
  userId: string
  orgId: string
  // Future: additional attributes (roles, groups, etc.)
}

interface EvaluationContext {
  environment: Environment
  timestamp?: DateTime  // For deterministic replay
  metadata?: Record<string, string>
}
```

---

#### EvaluationDecision

```typescript
interface EvaluationDecision {
  allowed: boolean
  reason: DecisionReason
  policyVersion?: PolicyVersionId
  evaluatedAt: DateTime
  latencyMs: number
}

type DecisionReason = 
  | 'policy_match'           // Policy found and principal allowed
  | 'plan_not_allowed'       // Policy found but plan doesn't allow
  | 'no_policy_found'        // No policy configured for capability
  | 'policy_error'           // Policy evaluation failed
  | 'tenant_suspended'       // Tenant is not active
```

**Invariants:**
- `allowed: true` implies `reason: 'policy_match'` and `policyVersion` must be set
- `allowed: false` requires a specific reason

---

### Services

#### DecisionEvaluator

The core service responsible for evaluation logic.

```typescript
interface IDecisionEvaluator {
  evaluate(
    tenantScope: TenantScope,
    request: EvaluationRequest
  ): Promise<EvaluationDecision>
}
```

**Implementation Pseudocode:**

```typescript
async function evaluate(
  tenantScope: TenantScope,
  request: EvaluationRequest
): Promise<EvaluationDecision> {
  const startTime = performance.now()
  
  // 1. Resolve active policy for capability
  const policy = await policyRepository.getActivePolicy(
    tenantScope,
    request.capability
  )
  
  if (!policy) {
    return {
      allowed: false,
      reason: 'no_policy_found',
      evaluatedAt: now(),
      latencyMs: elapsed(startTime)
    }
  }
  
  // 2. Fetch principal's plan (from client context or lookup)
  const principalPlan = request.context?.metadata?.plan
  
  if (!principalPlan) {
    return {
      allowed: false,
      reason: 'plan_not_found',
      evaluatedAt: now(),
      latencyMs: elapsed(startTime)
    }
  }
  
  // 3. Evaluate policy rules (MVP: simple allowlist)
  const allowed = policy.rules.allowedPlans.includes(principalPlan)
  
  const decision: EvaluationDecision = {
    allowed,
    reason: allowed ? 'policy_match' : 'plan_not_allowed',
    policyVersion: policy.versionId,
    evaluatedAt: now(),
    latencyMs: elapsed(startTime)
  }
  
  // 4. Log decision (async, non-blocking)
  auditService.logDecision(tenantScope, request, decision).catch(logError)
  
  return decision
}
```

---

## Data Ownership

### Tables

**None.** This context is stateless and owns no persistent data.

### Data Access

- **Reads from:** Policy Management Context (policies, capabilities)
- **Writes to:** Audit Context (decision logs)

---

## API Contracts

### Public API

#### POST /v1/evaluate

**Purpose:** Primary runtime API for decision evaluation

```http
POST /v1/evaluate
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "capability": "export-data",
  "principal": {
    "userId": "user-123",
    "orgId": "org-456"
  },
  "context": {
    "environment": "production",
    "metadata": {
      "plan": "pro"
    }
  }
}
```

**Response (200 OK):**

```json
{
  "allowed": true,
  "reason": "policy_match",
  "policyVersion": "pver-789",
  "evaluatedAt": "2026-01-15T10:00:00.123Z",
  "latencyMs": 8
}
```

**Response (403 Forbidden):**

```json
{
  "allowed": false,
  "reason": "plan_not_allowed",
  "evaluatedAt": "2026-01-15T10:00:00.456Z",
  "latencyMs": 12
}
```

**Error Responses:**

- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - Invalid or missing API key
- `429 Too Many Requests` - Rate limit exceeded (future)
- `500 Internal Server Error` - Unexpected evaluation failure

---

### Internal APIs

None. This context exposes only the public `/v1/evaluate` endpoint.

---

## Integration Points

### Upstream Dependencies

1. **Tenant Identity Context:** Resolves `TenantScope` from API key
2. **Policy Management Context:** Provides active policies per tenant+environment

---

### Downstream Dependents

1. **Client Systems (via SDK):** Consume decisions to enforce locally
2. **Audit Context:** Receives decision logs

---

## Evaluation Algorithm (MVP)

### Step-by-Step

```
┌─────────────────────────────────────────┐
│ 1. Extract tenant scope from auth      │
├─────────────────────────────────────────┤
│ 2. Fetch active policy for capability  │
│    - Query Policy Management Context    │
│    - Use cached policies if available   │
├─────────────────────────────────────────┤
│ 3. Extract principal's plan            │
│    - From request.context.metadata.plan │
├─────────────────────────────────────────┤
│ 4. Evaluate policy rules                │
│    - MVP: Check if plan in allowedPlans │
├─────────────────────────────────────────┤
│ 5. Construct decision                   │
│    - allowed: true/false                │
│    - reason: specific rationale         │
│    - policyVersion: reference           │
├─────────────────────────────────────────┤
│ 6. Log decision (async)                 │
│    - Fire-and-forget to Audit Context   │
├─────────────────────────────────────────┤
│ 7. Return decision                      │
└─────────────────────────────────────────┘
```

### Determinism Guarantee

Given the same inputs (tenant, capability, principal, policy version), the evaluator **must** return the same decision.

**Achieved through:**
- Immutable policy versions
- No external side effects during evaluation
- Timestamp-based replay support

---

## Caching Strategy

### Policy Cache

**Purpose:** Avoid repeated database queries for the same policies

**Implementation:**
- In-memory cache per service instance
- Key: `{tenantId}:{environment}:{capability}`
- TTL: 5 minutes
- Invalidation: On policy activation (future: via event)

**Cache Miss Behavior:**
- Fetch from database
- Populate cache
- Continue evaluation

**Cache Failure:**
- Log error
- Fail-open to database (no blocking)

---

### SDK-Side Caching

Clients can implement their own caching layer:

```typescript
// Example SDK usage with caching
const cachedDecision = await entitleSDK.evaluate('export-data', {
  userId: 'user-123',
  orgId: 'org-456',
  cacheOptions: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: true
  }
})
```

SDK caching is **separate** and does not affect server-side evaluation.

---

## Non-Functional Requirements

### Performance

| Metric | MVP Target | Production Target |
|--------|------------|-------------------|
| P50 latency | < 20ms | < 5ms |
| P95 latency | < 100ms | < 10ms |
| P99 latency | < 200ms | < 50ms |
| Throughput | 100 req/s per instance | 1000 req/s per instance |

### Reliability

- **Availability:** 99.9% (MVP), 99.99% (production)
- **Error rate:** < 0.1% (excluding client errors)
- **Degradation mode:** Return cached/stale decisions if fresh evaluation fails

### Scalability

- Stateless design enables horizontal scaling
- No inter-service coordination required
- Cache warming on startup prevents cold-start latency

---

## Error Handling

### Evaluation Failures

| Scenario | Behavior | Reason Code |
|----------|----------|-------------|
| Policy not found | Deny access | `no_policy_found` |
| Policy corrupted | Deny access | `policy_error` |
| Principal plan missing | Deny access | `plan_not_found` |
| Database unavailable | Use cached policy or fail-closed | `policy_error` |
| Audit logging fails | Continue (log error) | N/A (doesn't affect decision) |

**Fail-Safe Principle:**  
When in doubt, deny access. False negatives (denying valid access) are safer than false positives (allowing invalid access).

---

## Shadow Mode Support

**Purpose:** Allow clients to test Entitle without enforcing decisions

### Implementation

SDK supports a `shadowMode` flag:

```typescript
const decision = await entitleSDK.evaluate('export-data', principal, {
  shadowMode: true
})

// Client still executes their existing logic
// But logs Entitle's decision for comparison
logger.info('Entitle decision (shadow):', decision)
```

Shadow mode decisions are logged with a `shadow: true` flag in Audit Context.

---

## Testing Strategy

### Unit Tests

- Decision logic for all rule types
- Reason code correctness
- Cache behavior
- Error handling

### Integration Tests

- End-to-end evaluation with real policies
- Multi-tenant isolation
- Policy cache invalidation

### Performance Tests

- Latency under load
- Cache hit/miss ratios
- Concurrent request handling

### Chaos Tests

- Database unavailability
- Policy corruption
- Audit service failures

---

## Observability

### Metrics

- `entitle.evaluate.requests.total` (counter, by capability)
- `entitle.evaluate.latency.ms` (histogram)
- `entitle.evaluate.decisions.allowed` (counter)
- `entitle.evaluate.decisions.denied` (counter, by reason)
- `entitle.evaluate.cache.hits` (counter)
- `entitle.evaluate.cache.misses` (counter)
- `entitle.evaluate.errors` (counter, by error type)

### Traces

Every evaluation should produce a trace span including:
- Tenant ID
- Capability name
- Decision outcome
- Policy version evaluated
- Latency breakdown (policy fetch, evaluation, logging)

### Logs

**Structured log for every decision:**

```json
{
  "timestamp": "2026-01-15T10:00:00.123Z",
  "level": "info",
  "message": "Evaluation completed",
  "tenantId": "tenant-123",
  "capability": "export-data",
  "decision": {
    "allowed": true,
    "reason": "policy_match"
  },
  "latencyMs": 8,
  "cacheHit": true
}
```

---

## Security Considerations

### Tenant Isolation

- All queries scoped to `tenantScope.tenantId`
- No cross-tenant policy leakage possible
- Tenant context derived from authentication (never from request payload)

### Input Validation

- Capability names validated (format, length)
- Principal identifiers sanitized
- Metadata size limits enforced

### Rate Limiting (Future)

- Per-tenant rate limits
- Per-API-key rate limits
- Adaptive throttling under load

---

## Extensibility

This context is designed to support future evaluation capabilities:
- Advanced rule types (ABAC, time-based, usage-based)
- Real-time policy updates (event-driven cache invalidation)
- Policy snapshots for offline evaluation

For planned future capabilities, see [Future Enhancements](../future/IDEAS.md).

---

## Open Questions (MVP)

1. **Default decision when no policy exists:**  
   *Decision: Deny (fail-safe)*

2. **Audit logging failures:**  
   *Decision: Log error but don't block decision*

3. **Cache invalidation:**  
   *Decision: TTL-based (5 min)*

4. **Principal plan resolution:**  
   *Decision: Passed in request metadata*

---

## Related Contexts

- [Context Map](context_map.md)
- [Policy Management Context](policy_management_context.md) - Source of policies
- [Tenant Identity Context](tenant_identity_context.md) - Provides tenant scope
- [Audit Context](audit_context.md) - Consumer of decision logs

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-15 | Initial draft | Platform Team |
