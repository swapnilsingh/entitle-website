# Usage Tracking Context

**Domain Classification:** Supporting Domain  
**Owner:** Policy Team  
**Status:** Deferred to v1.1+

---

## Purpose

The Usage Tracking Context will track consumption of capabilities and evaluate usage against configured limits. **Critically, this context provides advisory signals only—it never enforces limits or blocks access.** Enforcement remains the client's responsibility.

---

## Status

**This context is not part of MVP (v1.0).**  

This document serves as a design preview for future implementation.

---

## Ubiquitous Language

### Core Concepts

**Usage Counter**  
A numeric accumulator tracking how many times a capability has been consumed by a principal within a time window.

**Limit**  
A configured threshold for usage, typically associated with a plan or capability.

**Usage Period**  
The time window over which usage is measured (e.g., monthly, daily, per-request).

**Advisory Signal**  
A non-blocking notification that a limit has been approached or exceeded (e.g., "near_limit", "exceeded").

**Usage Report**  
Data sent by client systems to record consumption of a capability.

---

## Responsibilities

### Primary

1. **Accept usage reports** from client systems
2. **Maintain usage counters** per tenant/org/user
3. **Evaluate usage against limits** configured in policies
4. **Emit advisory signals** (near-limit, exceeded)
5. **Reset counters** based on usage period (e.g., monthly)

### Secondary

6. Provide usage dashboards (future)
7. Generate usage reports for billing systems (future)

---

## What This Context Will NOT Do

### Explicitly Out of Scope

- ❌ Enforce limits (client responsibility)
- ❌ Block or throttle requests
- ❌ Replace billing systems
- ❌ Make authorization decisions (that's Decision Evaluation Context)

**Critical Boundary:**  
This context provides **information only**. It does not control access.

---

## Domain Model (Proposed)

### Entities

#### UsageCounter

```typescript
interface UsageCounter {
  id: UsageCounterId
  tenantId: TenantId
  capability: CapabilityName
  principal: Principal
  period: UsagePeriod
  currentCount: number
  limit: number | null      // null = unlimited
  periodStart: DateTime
  periodEnd: DateTime
  lastIncrementedAt: DateTime
}

type UsagePeriod = 'monthly' | 'daily' | 'per-request'
```

---

#### UsageLimit

```typescript
interface UsageLimit {
  id: UsageLimitId
  tenantId: TenantId
  capability: CapabilityName
  plan: PlanName
  limit: number
  period: UsagePeriod
  warningThreshold: number  // e.g., 80% of limit
}
```

---

### Value Objects

#### UsageSignal

```typescript
interface UsageSignal {
  status: UsageStatus
  currentUsage: number
  limit: number
  percentUsed: number
}

type UsageStatus = 'within_limit' | 'near_limit' | 'exceeded'
```

---

## Data Ownership (Proposed)

### Tables

#### usage_counters

```sql
CREATE TABLE usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability VARCHAR(100) NOT NULL,
  principal JSONB NOT NULL,
  period VARCHAR(20) NOT NULL,
  current_count INTEGER NOT NULL DEFAULT 0,
  limit INTEGER,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  last_incremented_at TIMESTAMPTZ,
  
  CONSTRAINT usage_counters_unique 
    UNIQUE (tenant_id, capability, principal, period_start)
);

CREATE INDEX idx_usage_counters_tenant 
  ON usage_counters(tenant_id, period_end);
```

---

#### usage_limits

```sql
CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability VARCHAR(100) NOT NULL,
  plan VARCHAR(100) NOT NULL,
  limit INTEGER NOT NULL,
  period VARCHAR(20) NOT NULL,
  warning_threshold INTEGER NOT NULL,
  
  CONSTRAINT usage_limits_unique 
    UNIQUE (tenant_id, capability, plan)
);
```

---

## API Contracts (Proposed)

### Client APIs

#### Report Usage

```http
POST /v1/usage/report
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "capability": "api-calls",
  "principal": {
    "userId": "user-123",
    "orgId": "org-456"
  },
  "count": 1,
  "timestamp": "2026-01-15T10:00:00Z"
}

Response:
{
  "recorded": true,
  "signal": {
    "status": "within_limit",
    "currentUsage": 450,
    "limit": 1000,
    "percentUsed": 45
  }
}
```

---

#### Check Usage Status

```http
GET /v1/usage/status?capability=api-calls&userId=user-123&orgId=org-456
Authorization: Bearer {api_key}

Response:
{
  "capability": "api-calls",
  "signal": {
    "status": "near_limit",
    "currentUsage": 850,
    "limit": 1000,
    "percentUsed": 85
  },
  "periodEnd": "2026-02-01T00:00:00Z"
}
```

---

### Internal APIs

#### GetUsageSignal

```typescript
interface GetUsageSignalRequest {
  tenantScope: TenantScope
  capability: CapabilityName
  principal: Principal
}

interface GetUsageSignalResponse {
  signal: UsageSignal
}
```

**Used by:** Decision Evaluation Context (future integration)

---

## Integration Points

### Upstream Dependencies

1. **Tenant Identity Context:** Provides tenant scope
2. **Policy Management Context:** Defines usage limits per plan

---

### Downstream Dependents

1. **Client Systems:** Receive usage signals
2. **Decision Evaluation Context (future):** Incorporate usage status into decisions
3. **Billing Systems (future):** Sync usage for metering

---

## Usage Flow (Proposed)

```
┌──────────────────────────┐
│ Client System            │
│ - Performs action        │
│ - Reports usage to Entitle│
└──────────┬───────────────┘
           │
           │ POST /v1/usage/report
           │
┌──────────▼───────────────┐
│ Usage Tracking Context   │
│ - Increment counter      │
│ - Evaluate against limit │
│ - Return advisory signal │
└──────────┬───────────────┘
           │
           │ {status: "near_limit"}
           │
┌──────────▼───────────────┐
│ Client System            │
│ - Receives signal        │
│ - Decides how to respond │
│   (warn user, restrict, etc.)│
└──────────────────────────┘
```

---

## Non-Functional Requirements

### Performance

- **Report latency:** P95 < 100ms
- **Increment throughput:** 10,000+ reports/second
- **Counter query latency:** P95 < 50ms

### Consistency

- **Eventual consistency OK:** Slight delays in counter updates acceptable
- **Counter accuracy:** Aim for 99%+ accuracy (some loss acceptable under load)

### Scalability

- Counters stored per principal, not globally (enables sharding)
- Periodic counter resets (monthly) prevent unbounded growth

---

## Counter Reset Strategy

### Monthly Reset

```typescript
// Scheduled job runs daily
async function resetExpiredCounters() {
  const now = new Date()
  
  // Find counters where period_end < now
  const expiredCounters = await db.query(
    'SELECT id FROM usage_counters WHERE period_end < $1',
    [now]
  )
  
  for (const counter of expiredCounters) {
    // Archive old counter
    await archiveCounter(counter.id)
    
    // Create new counter for next period
    await createCounter({
      ...counter,
      currentCount: 0,
      periodStart: counter.periodEnd,
      periodEnd: addMonths(counter.periodEnd, 1)
    })
  }
}
```

---

## Advisory Signal Logic

### Status Determination

```typescript
function determineUsageStatus(
  currentCount: number,
  limit: number,
  warningThreshold: number
): UsageStatus {
  const percentUsed = (currentCount / limit) * 100
  
  if (percentUsed >= 100) {
    return 'exceeded'
  } else if (percentUsed >= warningThreshold) {
    return 'near_limit'
  } else {
    return 'within_limit'
  }
}
```

### Client Response to Signals

| Signal | Typical Client Action |
|--------|-----------------------|
| `within_limit` | Proceed normally |
| `near_limit` | Warn user ("You've used 80% of your quota") |
| `exceeded` | Block action or prompt upgrade |

**Critical:** Entitle never enforces these actions—clients choose how to respond.

---

## Testing Strategy (Future)

### Unit Tests

- Counter increment logic
- Limit evaluation
- Period rollover

### Integration Tests

- End-to-end usage reporting
- Signal accuracy under load
- Counter reset jobs

### Stress Tests

- High-volume usage reporting
- Concurrent counter increments
- Counter drift analysis

---

## Migration Path

### v1.1

- Basic usage tracking (monthly periods)
- Simple advisory signals (near_limit, exceeded)
- Manual limit configuration via API

### v1.2+

- Fine-grained periods (daily, hourly)
- Usage-based policy rules (integrate with Decision Evaluation Context)
- Self-service limit management for customers

### v2.0+

- Real-time usage streams
- Predictive signals ("You'll exceed in 3 days")
- Usage-based billing integration

---

## Open Questions / Design Decisions

1. **Counter atomicity:** How to handle concurrent increments?  
   *Proposed: Optimistic locking or atomic database operations*

2. **Counter drift:** What if client reports are lost/duplicated?  
   *Proposed: Idempotency keys for reports*

3. **Free tier behavior:** Should unlimited plans have counters?  
   *Proposed: Yes, for observability, but no limits*

4. **Cross-org usage:** Should usage aggregate at org level?  
   *Proposed: Support both user-level and org-level counters*

---

## Why This Is Separate from Decision Evaluation

1. **Different latency requirements:** Usage tracking can tolerate higher latency
2. **Different data models:** Counters are mutable; policies are immutable
3. **Optional feature:** Clients may want evaluations without usage tracking
4. **Scalability:** Usage counters grow rapidly; decision evaluation is stateless

**Separation ensures Decision Evaluation Context remains fast and simple.**

---

## Related Contexts

- [Context Map](context_map.md)
- [Decision Evaluation Context](decision_evaluation_context.md) - Future consumer of signals
- [Policy Management Context](policy_management_context.md) - Defines limits
- [Tenant Identity Context](tenant_identity_context.md) - Provides tenant scope

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-15 | Initial draft (design preview) | Policy Team |
