# Audit & Observability Context

**Domain Classification:** Supporting Domain  
**Owner:** Platform Team  
**Status:** MVP v1.0

---

## Purpose

The Audit & Observability Context provides an immutable record of all policy decisions made by the Decision Evaluation Context. It serves three primary purposes: operational debugging, compliance auditing, and trust-building with customers.

---

## Ubiquitous Language

### Core Concepts

**Decision Log**  
An immutable record of a single evaluation event, capturing what was requested, what was decided, and why.

**Decision Trace**  
The full context and reasoning behind a decision, enabling root-cause analysis for unexpected outcomes.

**Audit Trail**  
A historical sequence of decisions, used for compliance reporting and security analysis.

**Retention Policy**  
Rules governing how long decision logs are stored before archival or deletion.

**Query Interface** *(Post-MVP)*  
APIs that allow authorized users to search and analyze decision history.

---

## Responsibilities

### Primary

1. **Record every evaluation decision** in real-time
2. **Store decision context** (tenant, capability, principal, outcome)
3. **Capture decision rationale** (why was access allowed/denied)
4. **Provide decision history** for debugging and compliance (future)
5. **Ensure data integrity** (append-only, immutable logs)

### Secondary

6. Generate compliance reports (future)
7. Detect anomalous access patterns (future)
8. Support policy impact analysis (future)

---

## What This Context Does NOT Do

### Explicitly Out of Scope

- ❌ Make or influence evaluation decisions
- ❌ Block or throttle evaluation requests
- ❌ Modify or delete past decisions (immutable)
- ❌ Perform real-time analytics (that's observability/metrics)
- ❌ Store usage data or quotas (that's Usage Tracking Context)

**Critical Boundary:**  
Audit Context is **write-only** during evaluations. It never blocks the decision path.

---

## Domain Model

### Entities

#### DecisionLog

```typescript
interface DecisionLog {
  id: DecisionLogId         // UUID
  tenantId: TenantId
  capability: CapabilityName
  principal: Principal
  context: EvaluationContext
  decision: EvaluationDecision
  policyVersion: PolicyVersionId | null
  evaluatedAt: DateTime
  latencyMs: number
  shadowMode: boolean        // Was this a shadow evaluation?
  requestMetadata?: Record<string, string>
}
```

**Invariants:**
- Logs are immutable once created
- Logs cannot be deleted (only archived per retention policy)
- All fields are required (no partial logs)

---

### Value Objects

#### AuditTraceEntry

```typescript
interface AuditTraceEntry {
  timestamp: DateTime
  action: string             // "decision_evaluated"
  actor: string              // API key prefix or system identifier
  outcome: 'allowed' | 'denied'
  reason: DecisionReason
  policyVersion?: PolicyVersionId
}
```

This is a flattened, queryable representation of a decision log for audit purposes.

---

## Data Ownership

### Tables

#### decision_logs

```sql
CREATE TABLE decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability VARCHAR(100) NOT NULL,
  principal JSONB NOT NULL,  -- {userId, orgId, ...}
  context JSONB NOT NULL,    -- {environment, metadata, ...}
  decision JSONB NOT NULL,   -- {allowed, reason, ...}
  policy_version_id UUID REFERENCES policy_versions(id),
  evaluated_at TIMESTAMPTZ NOT NULL,
  latency_ms INTEGER NOT NULL,
  shadow_mode BOOLEAN NOT NULL DEFAULT false,
  request_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries (MVP: write-only, but prepared for future)
CREATE INDEX idx_decision_logs_tenant_time 
  ON decision_logs(tenant_id, evaluated_at DESC);

CREATE INDEX idx_decision_logs_capability 
  ON decision_logs(tenant_id, capability, evaluated_at DESC);

CREATE INDEX idx_decision_logs_outcome 
  ON decision_logs(tenant_id, (decision->>'allowed'), evaluated_at DESC);

-- Partition by month for performance (future)
-- CREATE TABLE decision_logs_2026_01 PARTITION OF decision_logs
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## API Contracts

### Internal APIs

#### LogDecision

```typescript
interface LogDecisionRequest {
  tenantScope: TenantScope
  evaluationRequest: EvaluationRequest
  decision: EvaluationDecision
  shadowMode?: boolean
}

interface LogDecisionResponse {
  logId: DecisionLogId
  success: boolean
}
```

**Implementation Notes:**
- This is called asynchronously by Decision Evaluation Context
- Failures do not affect the decision outcome
- Logs are written via a message queue (future) or direct database insert (MVP)

---

### Admin APIs (Post-MVP)

#### Query Decision History

```http
GET /v1/audit/decisions?capability={cap}&from={start}&to={end}
Authorization: Bearer {api_key}

Response:
{
  "decisions": [
    {
      "id": "log-123",
      "capability": "export-data",
      "principal": {"userId": "user-123", "orgId": "org-456"},
      "decision": {"allowed": true, "reason": "policy_match"},
      "evaluatedAt": "2026-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "pageSize": 50
  }
}
```

**Status:** Deferred to v1.1+

---

## Integration Points

### Upstream Dependencies

1. **Decision Evaluation Context:** Produces decision logs
2. **Tenant Identity Context:** Provides tenant scope

---

### Downstream Dependents

1. **Admin Console (future):** Queries decision history
2. **Compliance Exports (future):** Generates audit reports
3. **Anomaly Detection (future):** Analyzes decision patterns

---

## Write Path (MVP)

### Logging Flow

```
┌────────────────────────────────────┐
│ Decision Evaluation Context        │
│ - Completes evaluation             │
│ - Fires LogDecision (async)        │
└────────────┬───────────────────────┘
             │
             │ Non-blocking
             │
┌────────────▼───────────────────────┐
│ Audit Context                      │
│ - Receives log request             │
│ - Validates required fields        │
│ - Inserts into decision_logs table │
│ - Emits metrics                    │
└────────────────────────────────────┘
```

**Async Implementation:**

Option A (MVP): Direct async database insert
```typescript
// Fire and forget, with error logging
logDecision(request).catch(err => {
  logger.error('Failed to log decision', { err, request })
  metrics.increment('audit.log.errors')
})
```

Option B (Post-MVP): Message queue
```typescript
await messageQueue.publish('audit.decisions', logRequest)
// Consumer processes queue and writes to database
```

---

## Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| Log write latency | < 50ms |
| Write throughput | 1000+ logs/second |
| Database size growth | ~500 bytes per log |

**Capacity Planning:**
- 1M evaluations/day = ~500 MB/day = ~15 GB/month
- With 12-month retention: ~180 GB

### Reliability

- **Durability:** Logs must not be lost once decision is returned
- **Write failures:** Should not block decision evaluation
- **Eventual consistency:** OK if logs appear seconds after decision

### Auditability

- **Immutability:** Logs cannot be modified after creation
- **Completeness:** Every evaluation must be logged (no sampling)
- **Tamper-evidence:** Cryptographic signatures (future)

---

## Data Retention

### MVP Strategy

- **Retention Period:** 90 days
- **Archival:** No automatic archival (manual export if needed)
- **Deletion:** Soft delete after 90 days (mark with `archived_at` timestamp)

### Future Enhancements

- Long-term archival to S3/GCS (compressed JSONL)
- Compliance-driven retention (e.g., GDPR, SOC2)
- Hot/warm/cold storage tiers

---

## Privacy & Compliance

### Sensitive Data Handling

**Data Classification:**
- **Public:** Capability names, decision outcomes
- **Confidential:** Principal identifiers (userId, orgId)
- **Restricted:** Request metadata (may contain PII)

**Redaction Rules:**
- Mask or encrypt principal identifiers in logs (future)
- Do not log sensitive metadata fields (e.g., passwords, tokens)

### GDPR Compliance

- **Right to Erasure:** Logs containing user data can be deleted on request
- **Data Minimization:** Only log what's necessary for debugging/audit
- **Retention Limits:** Automatic deletion after retention period

---

## Observability

### Metrics

- `entitle.audit.logs.written` (counter)
- `entitle.audit.logs.failed` (counter)
- `entitle.audit.write_latency.ms` (histogram)
- `entitle.audit.storage.bytes` (gauge)

### Alerts

- **High write failure rate** (> 1% of logs failing)
- **Write latency spike** (P99 > 500ms)
- **Storage capacity** (> 80% of allocated space)

---

## Testing Strategy

### Unit Tests

- Log serialization and validation
- Required field enforcement
- Immutability guarantees

### Integration Tests

- End-to-end logging from Decision Evaluation Context
- Log retrieval and querying (future)
- Retention policy enforcement

### Performance Tests

- Sustained write throughput
- Write latency under load
- Database growth projections

---

## Extensibility

This context is designed to support future audit capabilities:
- Query API for decision history
- Advanced analytics and anomaly detection
- Compliance report generation

For planned future capabilities, see [Future Enhancements](../future/IDEAS.md).

---

## Security Considerations

### Access Control

- Decision logs are tenant-scoped
- Only authorized admins can query logs (future)
- Logs cannot be modified or deleted by tenants

### Data Integrity

- Append-only table (no UPDATE or DELETE operations in application code)
- Database constraints enforce required fields
- Checksums or signatures for tamper detection (future)

---

## Open Questions / Decisions Needed

1. **Sampling for high-volume tenants:**  
   *Decision: No sampling in MVP. Full logging required for trust-building.*

2. **Async write failures:**  
   *Decision: Log error and emit metric. Do not retry (idempotency issues).*

3. **Long-term archival format:**  
   *Proposed: Compressed JSONL in S3, partitioned by year-month.*

---

## Related Contexts

- [Context Map](context_map.md)
- [Decision Evaluation Context](decision_evaluation_context.md) - Producer of logs
- [Tenant Identity Context](tenant_identity_context.md) - Provides tenant scope
- [Policy Management Context](policy_management_context.md) - Policy versions referenced in logs

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-15 | Initial draft | Platform Team |
