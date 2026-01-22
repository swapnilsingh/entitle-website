# Policy Management Context

**Domain Classification:** Supporting Domain  
**Owner:** Policy Team  
**Status:** MVP v1.0

---

## Purpose

The Policy Management Context is responsible for defining and managing commercial access policies. It provides the declarative rules that the Decision Evaluation Context uses to determine capability access, while maintaining a complete audit trail of policy changes.

---

## Ubiquitous Language

### Core Concepts

**Policy**  
A declarative rule that maps capabilities to conditions under which they are allowed. In MVP, this is a simple allow-list mapping plans to capabilities.

**Capability**  
A named feature or action that may be subject to entitlement control (e.g., `export-data`, `api-access`, `advanced-analytics`).

**Plan**  
A pricing or subscription tier (e.g., `free`, `pro`, `enterprise`). Plans are the primary mechanism for grouping capabilities in MVP.

**Policy Version**  
An immutable snapshot of a policy at a specific point in time. Every policy change creates a new version, ensuring complete auditability and the ability to reason about historical decisions.

**Policy Activation**  
The act of making a specific policy version effective within an environment. Only one version of a policy can be active per environment at a time.

**Environment Scoping**  
Policies can be configured differently across environments (dev, staging, production), allowing safe testing before production rollout.

---

## Responsibilities

### Primary

1. **Define capabilities** that can be controlled
2. **Create and version policies** mapping plans to capabilities
3. **Activate policy versions** per environment
4. **Maintain policy history** for audit and rollback
5. **Scope policies to tenants** and environments

### Secondary

6. Validate policy definitions for correctness
7. Provide policy query interfaces for Decision Evaluation Context
8. Support policy rollback scenarios

---

## What This Context Does NOT Do

### Explicitly Out of Scope

- ❌ Evaluate policies at runtime (that's Decision Evaluation Context)
- ❌ Enforce policies (client responsibility)
- ❌ Define pricing or billing rules (external concern)
- ❌ Execute workflows or business logic
- ❌ Manage feature behavior

---

## Domain Model

### Entities

#### Capability

```typescript
interface Capability {
  id: CapabilityId       // UUID
  tenantId: TenantId
  name: CapabilityName   // e.g., "export-data"
  description: string
  createdAt: DateTime
  updatedAt: DateTime
  status: CapabilityStatus
}

type CapabilityName = string  // kebab-case identifier
type CapabilityStatus = 'active' | 'deprecated'
```

**Invariants:**
- Capability names are unique per tenant
- Capability names are immutable (cannot be renamed)
- Deprecated capabilities can still be evaluated (for backward compatibility)

**Naming Conventions:**
- Use kebab-case: `export-data`, `api-access`
- Be specific: `bulk-export` not just `export`
- Avoid business logic terms: `pro-features` ❌, list capabilities explicitly ✅

---

#### Plan

```typescript
interface Plan {
  id: PlanId             // UUID
  tenantId: TenantId
  name: PlanName         // e.g., "pro", "enterprise"
  displayName: string    // e.g., "Professional Plan"
  description: string
  createdAt: DateTime
  updatedAt: DateTime
  status: PlanStatus
}

type PlanName = string
type PlanStatus = 'active' | 'archived'
```

**Invariants:**
- Plan names are unique per tenant
- Archived plans cannot be assigned to new customers (but existing mappings remain valid)

---

#### Policy

```typescript
interface Policy {
  id: PolicyId           // UUID
  tenantId: TenantId
  capabilityId: CapabilityId
  name: string           // Human-readable name for admin UI
  description: string
  createdAt: DateTime
  currentVersionId: PolicyVersionId | null
}
```

A policy is a container for versions. The policy entity itself doesn't hold rules—those live in PolicyVersion.

---

#### PolicyVersion

```typescript
interface PolicyVersion {
  id: PolicyVersionId    // UUID
  policyId: PolicyId
  tenantId: TenantId
  version: number        // Auto-incrementing per policy
  rules: PolicyRules     // The actual policy logic (JSON)
  createdAt: DateTime
  createdBy: string      // User/system that created this version
  changelog: string      // Description of what changed
  status: PolicyVersionStatus
}

type PolicyVersionStatus = 'draft' | 'active' | 'superseded' | 'archived'

// MVP: Simple allow-list model
interface PolicyRules {
  type: 'plan-allowlist' // Only type supported in MVP
  allowedPlans: PlanName[]
  denyOverrides?: PlanName[]  // Explicit denies (future)
}
```

**Invariants:**
- Version numbers are sequential per policy
- Only one version can be 'active' per policy per environment
- Versions are immutable once created

**Status Transitions:**
```
draft → active → superseded
        ↓
     archived (manual)
```

---

### Value Objects

#### PolicyEvaluationSnapshot

```typescript
interface PolicyEvaluationSnapshot {
  capabilityId: CapabilityId
  capabilityName: CapabilityName
  activeVersion: PolicyVersionId
  rules: PolicyRules
  effectiveFrom: DateTime
}
```

This is what the Decision Evaluation Context consumes—a read-optimized view of active policies.

---

## Data Ownership

### Tables

#### capabilities

```sql
CREATE TABLE capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT capabilities_name_check CHECK (name ~ '^[a-z0-9-]+$'),
  CONSTRAINT capabilities_unique_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_capabilities_tenant ON capabilities(tenant_id, status);
```

---

#### plans

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT plans_unique_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_plans_tenant ON plans(tenant_id, status);
```

---

#### policies

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_version_id UUID,
  
  CONSTRAINT policies_unique_capability UNIQUE (tenant_id, capability_id)
);

CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_policies_capability ON policies(capability_id);
```

---

#### policy_versions

```sql
CREATE TABLE policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  rules JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'active', 'superseded', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  changelog TEXT,
  
  CONSTRAINT policy_versions_unique UNIQUE (policy_id, version)
);

CREATE INDEX idx_policy_versions_status ON policy_versions(policy_id, status) 
  WHERE status = 'active';
CREATE INDEX idx_policy_versions_tenant ON policy_versions(tenant_id);
```

---

#### policy_activations

```sql
CREATE TABLE policy_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_version_id UUID NOT NULL REFERENCES policy_versions(id),
  environment VARCHAR(20) NOT NULL 
    CHECK (environment IN ('dev', 'staging', 'production')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by VARCHAR(255),
  
  CONSTRAINT policy_activations_unique 
    UNIQUE (policy_version_id, environment)
);

CREATE INDEX idx_policy_activations_env 
  ON policy_activations(tenant_id, environment, activated_at);
```

---

## API Contracts

### Admin APIs (MVP - Internal Only)

#### Create Capability

```http
POST /v1/capabilities
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "name": "export-data",
  "description": "Ability to export data to external formats"
}

Response:
{
  "capability": {
    "id": "cap-123",
    "name": "export-data",
    "status": "active",
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

---

#### Create Policy

```http
POST /v1/policies
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "capabilityId": "cap-123",
  "name": "Export Data Policy",
  "description": "Controls access to data export functionality",
  "rules": {
    "type": "plan-allowlist",
    "allowedPlans": ["pro", "enterprise"]
  }
}

Response:
{
  "policy": {
    "id": "pol-456",
    "capabilityId": "cap-123",
    "currentVersion": {
      "id": "pver-789",
      "version": 1,
      "status": "draft"
    }
  }
}
```

---

#### Activate Policy Version

```http
POST /v1/policies/{policyId}/versions/{versionId}/activate
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "environment": "production",
  "changelog": "Enable export for pro tier customers"
}

Response:
{
  "activation": {
    "policyVersionId": "pver-789",
    "environment": "production",
    "activatedAt": "2026-01-15T10:00:00Z",
    "status": "active"
  }
}
```

---

### Internal APIs (For Decision Evaluation Context)

#### GetActivePolicies

```typescript
interface GetActivePoliciesRequest {
  tenantScope: TenantScope
}

interface GetActivePoliciesResponse {
  policies: PolicyEvaluationSnapshot[]
}
```

This returns all active policies for a tenant+environment, optimized for evaluation.

---

## Integration Points

### Upstream Dependencies

- **Tenant Identity Context:** Provides tenant scope for all operations
- **Admin Console (future):** UI for policy management

---

### Downstream Dependents

- **Decision Evaluation Context:** Reads active policies for evaluation
- **Audit Context:** Logs policy changes

---

## Business Rules

### Policy Activation Rules

1. **One active version per environment:**  
   Activating a new version automatically supersedes the previous active version

2. **Environment progression (recommended):**  
   Best practice is to activate in: dev → staging → production

3. **Rollback support:**  
   Any previous version can be re-activated (creates a new activation record)

### Capability Naming Rules

- Must be kebab-case
- 3-50 characters
- Only lowercase letters, numbers, and hyphens
- Must not start or end with a hyphen

---

## Non-Functional Requirements

### Performance

- **Policy retrieval:** P95 < 50ms
- **Policy activation:** < 1 second
- **Caching:** Active policies cached per tenant+environment (TTL: 5 min)

### Consistency

- Policy versions are immutable
- Activation is atomic per environment
- Version numbering is gap-free per policy

### Auditability

- Every policy change creates a new version
- All activations are logged with timestamp and actor
- Changelog required for all activations

---

## Testing Strategy

### Unit Tests

- Policy version creation and sequencing
- Rule validation (allowed plans exist)
- Status transition rules

### Integration Tests

- End-to-end policy creation and activation
- Multi-environment activation
- Policy retrieval by Decision Evaluation Context

### Regression Tests

- Backward compatibility with previous policy versions
- Rollback scenarios

---

## Extensibility

This context is designed to support future policy capabilities:
- Advanced rule types (time-based, attribute-based)
- Policy templates and inheritance
- Customer-managed policy delegation

For planned future capabilities, see [Future Enhancements](../future/IDEAS.md).

---

## Open Questions (MVP)

1. **Policy rule validation:**  
   *Decision: Validate plan names exist at creation time*

2. **Capability retirement:**  
   *Decision: Must deprecate first before deletion*

3. **Default deny vs default allow:**  
   *Decision: Default deny (fail-safe)*

---

## Related Contexts

- [Context Map](context_map.md)
- [Decision Evaluation Context](decision_evaluation_context.md) - Consumer of policies
- [Tenant Identity Context](tenant_identity_context.md) - Provides tenant scoping
- [Audit Context](audit_context.md) - Logs policy changes

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-15 | Initial draft | Policy Team |
