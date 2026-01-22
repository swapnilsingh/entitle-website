# Tenant Identity Context

**Domain Classification:** Supporting Domain  
**Owner:** Platform Team  
**Status:** MVP v1.0

---

## Purpose

The Tenant Identity Context is responsible for establishing and maintaining the security boundary between different customers (tenants) of the Entitle platform. It provides authentication mechanisms and ensures complete data isolation across all operations.

---

## Ubiquitous Language

### Core Concepts

**Tenant**  
An isolated organizational unit representing a single customer of the Entitle platform. All data and operations are scoped to a tenant, creating hard isolation boundaries.

**API Key**  
A cryptographic credential that uniquely identifies a tenant within a specific environment. API keys are the authentication mechanism for programmatic access.

**Environment**  
A deployment stage or isolation boundary (e.g., `dev`, `staging`, `production`). Each tenant can have separate API keys per environment, enabling safe testing without production risk.

**Tenant Scope**  
The execution context derived from authentication that ensures all downstream operations are isolated to a single tenant. This scope propagates through all contexts.

**API Key Rotation**  
The process of issuing a new API key while maintaining a grace period for the old key, enabling zero-downtime credential updates.

---

## Responsibilities

### Primary

1. **Authenticate API requests** using API keys
2. **Resolve tenant identity** from authentication credentials
3. **Issue and manage API keys** per tenant per environment
4. **Enforce tenant isolation** at the infrastructure level
5. **Manage environment separation** (dev/staging/prod)

### Secondary

6. Provide tenant metadata (name, status, created date)
7. Support API key rotation workflows
8. Track API key usage for security monitoring

---

## What This Context Does NOT Do

### Explicitly Out of Scope

- ❌ Make authorization decisions (that's Decision Evaluation Context)
- ❌ Manage user accounts within tenants (client responsibility)
- ❌ Store or manage policies (that's Policy Management Context)
- ❌ Perform rate limiting or throttling (infrastructure concern)
- ❌ Handle billing or subscription status (external system)

---

## Domain Model

### Entities

#### Tenant

```typescript
interface Tenant {
  id: TenantId           // UUID
  name: string
  status: TenantStatus   // active | suspended | deleted
  createdAt: DateTime
  updatedAt: DateTime
  metadata: TenantMetadata
}

type TenantStatus = 'active' | 'suspended' | 'deleted'

interface TenantMetadata {
  organizationName?: string
  contactEmail?: string
  // Extensible for future needs
}
```

**Invariants:**
- Tenant ID is immutable once created
- Deleted tenants cannot be reactivated (soft delete)
- Suspended tenants cannot authenticate

---

#### APIKey

```typescript
interface APIKey {
  id: APIKeyId           // UUID
  tenantId: TenantId
  environment: Environment
  keyHash: string        // bcrypt hash of the actual key
  prefix: string         // First 8 chars for identification (e.g., "ent_prod_")
  status: APIKeyStatus
  createdAt: DateTime
  lastUsedAt: DateTime | null
  expiresAt: DateTime | null
  revokedAt: DateTime | null
}

type Environment = 'dev' | 'staging' | 'production'
type APIKeyStatus = 'active' | 'revoked' | 'expired'
```

**Invariants:**
- Each tenant can have multiple API keys per environment
- Only one primary active key per tenant-environment pair (for simplicity in MVP)
- Revoked keys cannot be reactivated
- API keys are never stored in plaintext

**Key Format:**
```
ent_{environment}_{random_32_chars}
Example: ent_prod_k9jd8s7f6g5h4j3k2l1m0n9b8v7c6x
```

---

### Value Objects

#### TenantScope

```typescript
interface TenantScope {
  tenantId: TenantId
  environment: Environment
}
```

This value object is propagated to all downstream contexts to ensure operations are scoped correctly.

---

## Data Ownership

### Tables

#### tenants

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  
  CONSTRAINT tenants_name_check CHECK (length(name) >= 1)
);

CREATE INDEX idx_tenants_status ON tenants(status) WHERE status = 'active';
```

---

#### api_keys

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  key_hash VARCHAR(255) NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT api_keys_unique_active UNIQUE (tenant_id, environment, status) 
    WHERE status = 'active'
);

CREATE INDEX idx_api_keys_lookup ON api_keys(key_hash) WHERE status = 'active';
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id, environment);
```

**Row-Level Security:**
All queries must include `tenant_id` in WHERE clause to prevent cross-tenant data leakage.

---

## API Contracts

### Internal APIs (Used by Other Contexts)

These are **not exposed externally**, only used by other Entitle contexts.

#### ResolveTenantScope

```typescript
interface ResolveTenantScopeRequest {
  apiKey: string
}

interface ResolveTenantScopeResponse {
  tenantScope: TenantScope
  tenantStatus: TenantStatus
}

// Throws: InvalidCredentialsError, SuspendedTenantError
```

**Usage:**  
Called by authentication middleware to extract tenant scope before any operation.

---

### Admin APIs (MVP - Internal Only)

#### Create Tenant

```http
POST /internal/v1/tenants
Content-Type: application/json

{
  "name": "Acme Corp",
  "metadata": {
    "organizationName": "Acme Corporation",
    "contactEmail": "admin@acme.com"
  }
}

Response:
{
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corp",
    "status": "active",
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

---

#### Issue API Key

```http
POST /internal/v1/tenants/{tenantId}/api-keys
Content-Type: application/json

{
  "environment": "production"
}

Response:
{
  "apiKey": "ent_prod_k9jd8s7f6g5h4j3k2l1m0n9b8v7c6x",
  "prefix": "ent_prod_k9jd",
  "environment": "production",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

**Security Note:**  
The full API key is returned **only once** during creation. It is never retrievable again.

---

## Integration Points

### Upstream Dependencies

**Client Systems**  
Clients authenticate using API keys in HTTP headers:

```http
Authorization: Bearer ent_prod_k9jd8s7f6g5h4j3k2l1m0n9b8v7c6x
```

---

### Downstream Dependents

All other contexts depend on Tenant Identity Context to:
- Resolve `TenantScope` from authentication
- Validate tenant status before operations

**Integration Pattern:**  
Contexts receive `TenantScope` as a parameter; they **never** parse credentials directly.

---

## Anti-Corruption Layer

### Authentication Middleware

The authentication middleware acts as the ACL between HTTP requests and internal contexts:

```typescript
async function authenticateRequest(request: HttpRequest): Promise<TenantScope> {
  const apiKey = extractBearerToken(request)
  
  if (!apiKey) {
    throw new UnauthenticatedError('Missing API key')
  }
  
  const result = await tenantIdentityService.resolveTenantScope({ apiKey })
  
  if (result.tenantStatus !== 'active') {
    throw new SuspendedTenantError('Tenant is not active')
  }
  
  return result.tenantScope
}
```

This middleware ensures:
- No downstream context ever handles raw credentials
- Tenant scope is consistently derived
- Security checks happen at the boundary

---

## Security Considerations

### API Key Storage

- Keys are hashed using bcrypt (cost factor: 12)
- Only the hash is stored in the database
- The prefix is stored for identification in logs (without compromising security)

### Tenant Isolation

**Database Level:**
```sql
-- All queries must filter by tenant_id
WHERE tenant_id = $tenant_id_from_auth
```

**Application Level:**
- All service methods require `TenantScope` parameter
- No global queries without tenant context

**Enforcement:**
Database views or RLS policies (post-MVP) can enforce isolation at the database layer.

---

## Non-Functional Requirements

### Performance

- **Authentication latency:** P95 < 20ms
- **API key lookup:** Single indexed query
- **Caching:** API key → tenant mapping cached (TTL: 5 minutes)

### Reliability

- Cache failures must not block authentication (fail-open to database)
- Graceful handling of deleted/suspended tenants

### Observability

Log:
- All authentication attempts (success/failure)
- API key usage (for security monitoring)
- Tenant status changes

---

## Testing Strategy

### Unit Tests

- Tenant entity validation
- API key generation and hashing
- Status transition rules

### Integration Tests

- Tenant creation and retrieval
- API key issuance and authentication
- Cross-tenant isolation (negative tests)

### Security Tests

- API key cannot access wrong tenant
- Revoked keys rejected
- Suspended tenants blocked
- SQL injection attempts fail

---

## Extensibility

This context is designed to support future authentication enhancements:
- mTLS certificate-based authentication (v2.0+)
- Multi-key support per environment
- Self-service tenant provisioning

For planned future capabilities, see [Future Enhancements](../future/IDEAS.md).

---

## Open Questions (MVP)

1. **Key rotation grace period:** How long should old keys remain valid?  
   *Decision: 7 days*

2. **Max keys per tenant:**  
   *Decision: 1 active key per environment for MVP simplicity*

3. **Tenant deletion:**  
   *Decision: Soft delete with status = 'deleted'*

---

## Related Contexts

- [Context Map](context_map.md)
- [Decision Evaluation Context](decision_evaluation_context.md) - Consumer of TenantScope
- [Policy Management Context](policy_management_context.md) - Uses tenant scoping
- [Audit Context](audit_context.md) - Logs tenant-scoped actions

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-15 | Initial draft | Platform Team |
