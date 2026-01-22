# API Architecture (API-First Design)

**Version:** v1.0  
**Status:** Draft → Frozen (Week 0)  
**Approach:** OpenAPI 3.1 specification drives implementation  
**Last Updated:** 15 January 2026

---

## Design Philosophy

### API-First Principles

1. **Contract-First:** OpenAPI spec written BEFORE code
2. **Single Source of Truth:** All SDKs generated from spec
3. **Backward Compatibility:** Never break existing clients
4. **Explicit Over Implicit:** Clear request/response schemas
5. **Fast by Default:** Design for caching and minimal round trips

### RESTful Constraints

- **Resource-Oriented:** URLs represent resources, not actions
- **HTTP Verbs:** GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- **Stateless:** No server-side sessions, auth via API key per request
- **Cacheable:** Explicit cache headers (`Cache-Control`, `ETag`)
- **Idempotent:** PUT/DELETE/GET are safe to retry

### Non-REST Patterns (Where Justified)

- **Decision Evaluation:** `POST /v1/evaluate` (RPC-style, not CRUD) - acceptable because evaluation is an action, not a resource mutation

---

## API Versioning Strategy

### URL-Based Versioning

```
https://api.entitle.io/v1/tenants
https://api.entitle.io/v1/policies
https://api.entitle.io/v1/evaluate
```

**Rationale:**
- Clear, visible version in URL
- Easy to route in API gateway
- Supports side-by-side v1/v2 deployments

**Version Lifecycle:**
- v1.0: MVP (9 weeks)
- v1.x: Additive changes only (new fields, endpoints)
- v2.0: Breaking changes (post-MVP, 6+ months out)

### Breaking vs Non-Breaking Changes

**Non-Breaking (v1.x patch):**
- Add new optional fields to request
- Add new fields to response
- Add new endpoints
- Relax validation (accept more input)

**Breaking (requires v2.0):**
- Remove or rename fields
- Change field types
- Make optional field required
- Change error response format
- Change authentication method

---

## Authentication & Authorization

### API Key Authentication

**Header Format:**
```http
Authorization: Bearer ent_live_1a2b3c4d5e6f7g8h9i0j
```

**Key Format:**
- Prefix: `ent_` (brand)
- Environment: `live_` or `test_`
- Random: 20-char alphanumeric (base62)
- Example: `ent_live_a8Xk9PmN2vQ7wRyT4sU6`

**Security:**
- Stored as bcrypt hash (cost 12) in database
- Transmitted over TLS 1.3 only
- Rate limited (100 req/s per key baseline)
- Rotation supported (multiple active keys per tenant)

**Scopes (MVP: Single Scope)**
- MVP: Full access (no granular permissions)
- v2.0: Scoped keys (`evaluate:read`, `policy:write`, etc.)

### Tenant Isolation

Every request is scoped to the tenant identified by the API key:
- Tenant ID extracted from API key lookup
- All database queries filtered by `tenant_id`
- No cross-tenant data access possible
- Enforced at middleware level before request hits handlers

---

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "POLICY_NOT_FOUND",
    "message": "No active policy found for plan 'enterprise' in environment 'production'",
    "details": {
      "plan_key": "enterprise",
      "environment": "production",
      "tenant_id": "uuid-redacted"
    },
    "request_id": "req_a8Xk9PmN2vQ7",
    "timestamp": "2026-01-15T10:30:45Z"
  }
}
```

### Error Code Taxonomy

**Format:** `CONTEXT_ERROR_TYPE`

**4xx Client Errors:**
- `INVALID_REQUEST` - Malformed JSON, missing required fields
- `AUTHENTICATION_FAILED` - Invalid or missing API key
- `AUTHORIZATION_FAILED` - Valid key but insufficient permissions (v2.0+)
- `RESOURCE_NOT_FOUND` - Policy, tenant, plan not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VALIDATION_FAILED` - Input validation error (with field details)

**5xx Server Errors:**
- `INTERNAL_ERROR` - Unhandled exception (never expose internals)
- `DATABASE_ERROR` - Database connection failed (transient)
- `UPSTREAM_TIMEOUT` - Dependency timeout (future, if calling external services)

### HTTP Status Code Mapping

| Status | Condition | Error Code |
|--------|-----------|------------|
| 200 | Success | N/A |
| 201 | Created | N/A |
| 204 | No Content (DELETE) | N/A |
| 400 | Bad Request | `INVALID_REQUEST`, `VALIDATION_FAILED` |
| 401 | Unauthorized | `AUTHENTICATION_FAILED` |
| 403 | Forbidden | `AUTHORIZATION_FAILED` |
| 404 | Not Found | `RESOURCE_NOT_FOUND` |
| 429 | Too Many Requests | `RATE_LIMIT_EXCEEDED` |
| 500 | Internal Server Error | `INTERNAL_ERROR` |
| 502 | Bad Gateway | `UPSTREAM_ERROR` |
| 503 | Service Unavailable | `SERVICE_UNAVAILABLE` |
| 504 | Gateway Timeout | `UPSTREAM_TIMEOUT` |

### Retry Guidance

Response includes `Retry-After` header for transient errors:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

**Client Behavior:**
- 429: Retry after `Retry-After` seconds (exponential backoff)
- 500/502/503/504: Retry with exponential backoff (max 3 attempts)
- 400/401/403/404: Do NOT retry (client error, won't succeed)

---

## Rate Limiting

### Per-Tenant Limits (MVP)

| Endpoint | Rate Limit | Burst | Window |
|----------|-----------|-------|--------|
| `POST /v1/evaluate` | 100 req/s | 200 | 1 second |
| `GET /v1/policies/*` | 50 req/s | 100 | 1 second |
| `POST /v1/policies` | 10 req/s | 20 | 1 second |
| `PUT /v1/policies/:id` | 10 req/s | 20 | 1 second |
| All other endpoints | 50 req/s | 100 | 1 second |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705315845
```

**SDK Behavior:**
- Auto-retry with backoff if 429 received
- Warn if `X-RateLimit-Remaining` < 10
- Throw error if retries exhausted

---

## API Endpoints by Context

### Tenant Identity Context

**Internal Only (Admin UI, not exposed to customers in MVP)**

#### Create Tenant (Onboarding)
```http
POST /internal/v1/tenants
Authorization: Bearer <admin-token>

Request:
{
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "plan_key": "enterprise"
}

Response: 201 Created
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "api_key": "ent_live_a8Xk9PmN2vQ7wRyT4sU6",
  "created_at": "2026-01-15T10:30:00Z"
}
```

#### Rotate API Key
```http
POST /internal/v1/tenants/:tenant_id/api-keys/rotate
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "api_key": "ent_live_newKey9PmN2vQ7wRyT",
  "expires_at": null,
  "created_at": "2026-01-15T11:00:00Z"
}
```

#### Get Tenant Details
```http
GET /internal/v1/tenants/:tenant_id
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "plan_key": "enterprise",
  "status": "ACTIVE",
  "created_at": "2026-01-15T10:30:00Z"
}
```

---

### Policy Management Context

#### List Policies
```http
GET /v1/policies?environment=production&status=ACTIVE
Authorization: Bearer ent_live_...

Response: 200 OK
{
  "policies": [
    {
      "policy_id": "pol_7g8h9i0j1k2l3m4n",
      "plan_key": "enterprise",
      "version": 3,
      "environment": "production",
      "status": "ACTIVE",
      "activated_at": "2026-01-10T08:00:00Z",
      "capabilities": ["feature_a", "feature_b", "feature_c"]
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

#### Get Policy by ID
```http
GET /v1/policies/:policy_id
Authorization: Bearer ent_live_...

Response: 200 OK
{
  "policy_id": "pol_7g8h9i0j1k2l3m4n",
  "plan_key": "enterprise",
  "version": 3,
  "environment": "production",
  "status": "ACTIVE",
  "capabilities": ["feature_a", "feature_b", "feature_c"],
  "rules": {
    "type": "allow_list",
    "allowed_capabilities": ["feature_a", "feature_b", "feature_c"]
  },
  "created_at": "2026-01-10T07:55:00Z",
  "activated_at": "2026-01-10T08:00:00Z"
}
```

#### Create Policy (Draft)
```http
POST /v1/policies
Authorization: Bearer ent_live_...

Request:
{
  "plan_key": "enterprise",
  "environment": "staging",
  "capabilities": ["feature_a", "feature_b", "feature_c", "feature_d"]
}

Response: 201 Created
{
  "policy_id": "pol_newPolicy123",
  "plan_key": "enterprise",
  "version": 4,
  "environment": "staging",
  "status": "DRAFT",
  "capabilities": ["feature_a", "feature_b", "feature_c", "feature_d"],
  "created_at": "2026-01-15T10:45:00Z"
}
```

#### Activate Policy
```http
POST /v1/policies/:policy_id/activate
Authorization: Bearer ent_live_...

Response: 200 OK
{
  "policy_id": "pol_newPolicy123",
  "status": "ACTIVE",
  "activated_at": "2026-01-15T10:50:00Z",
  "previous_policy_id": "pol_7g8h9i0j1k2l3m4n"
}
```

#### Deactivate Policy
```http
POST /v1/policies/:policy_id/deactivate
Authorization: Bearer ent_live_...

Response: 200 OK
{
  "policy_id": "pol_7g8h9i0j1k2l3m4n",
  "status": "INACTIVE",
  "deactivated_at": "2026-01-15T10:55:00Z"
}
```

#### Delete Policy (Draft Only)
```http
DELETE /v1/policies/:policy_id
Authorization: Bearer ent_live_...

Response: 204 No Content
```

---

### Decision Evaluation Context

#### Evaluate Capability (Core PDP)
```http
POST /v1/evaluate
Authorization: Bearer ent_live_...

Request:
{
  "plan_key": "enterprise",
  "capability_id": "feature_a",
  "environment": "production",
  "context": {
    "user_id": "user_123",
    "request_ip": "203.0.113.42"
  }
}

Response: 200 OK
{
  "allowed": true,
  "reason": "capability enabled in plan",
  "policy_version": 3,
  "request_id": "req_a8Xk9PmN2vQ7",
  "timestamp": "2026-01-15T10:30:45Z",
  "ttl": 300
}
```

**Field Descriptions:**
- `plan_key`: Plan identifier (e.g., "free", "pro", "enterprise")
- `capability_id`: Feature identifier (e.g., "advanced_analytics")
- `environment`: "production" | "staging" | "development"
- `context`: Optional metadata for future rule evaluation (MVP: unused, logged only)
- `allowed`: Boolean decision
- `reason`: Human-readable explanation
- `policy_version`: Version of policy used for decision
- `ttl`: Cache validity in seconds (client can cache result)

#### Batch Evaluate (Optimization)
```http
POST /v1/evaluate/batch
Authorization: Bearer ent_live_...

Request:
{
  "plan_key": "enterprise",
  "environment": "production",
  "capabilities": ["feature_a", "feature_b", "feature_c", "feature_d"],
  "context": {
    "user_id": "user_123"
  }
}

Response: 200 OK
{
  "results": [
    {
      "capability_id": "feature_a",
      "allowed": true,
      "reason": "capability enabled in plan"
    },
    {
      "capability_id": "feature_b",
      "allowed": true,
      "reason": "capability enabled in plan"
    },
    {
      "capability_id": "feature_c",
      "allowed": true,
      "reason": "capability enabled in plan"
    },
    {
      "capability_id": "feature_d",
      "allowed": false,
      "reason": "capability not included in plan"
    }
  ],
  "policy_version": 3,
  "request_id": "req_batchXYZ123",
  "timestamp": "2026-01-15T10:31:00Z"
}
```

**Benefits:**
- Single request evaluates multiple capabilities
- Reduces network overhead (10x fewer requests)
- Useful for UI rendering (check all features at once)

---

### Audit Context

#### Query Decision Logs (Internal Admin Only)
```http
GET /internal/v1/audit/decisions?start_date=2026-01-14&end_date=2026-01-15&limit=100
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "logs": [
    {
      "log_id": "log_uuid123",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "plan_key": "enterprise",
      "capability_id": "feature_a",
      "environment": "production",
      "allowed": true,
      "reason": "capability enabled in plan",
      "policy_version": 3,
      "context": {
        "user_id": "user_123",
        "request_ip": "203.0.113.42"
      },
      "timestamp": "2026-01-15T10:30:45Z"
    }
  ],
  "total": 1847,
  "page": 1,
  "page_size": 100
}
```

**Query Parameters:**
- `start_date`: ISO 8601 date (inclusive)
- `end_date`: ISO 8601 date (inclusive)
- `tenant_id`: Filter by tenant (admin only)
- `capability_id`: Filter by specific capability
- `allowed`: Filter by decision (true/false)
- `limit`: Max results (default 100, max 1000)
- `offset`: Pagination offset

**Notes:**
- Logs are immutable (append-only)
- Retention: 90 days in MVP
- No UPDATE or DELETE operations
- Heavy queries may be rate-limited

---

## OpenAPI Spec Structure

### File Organization

```
api/
├── openapi.yaml              # Main spec (references components)
├── components/
│   ├── schemas/
│   │   ├── tenant.yaml       # Tenant-related schemas
│   │   ├── policy.yaml       # Policy schemas
│   │   ├── decision.yaml     # Evaluation schemas
│   │   ├── audit.yaml        # Audit log schemas
│   │   └── common.yaml       # Error, pagination, etc.
│   ├── parameters/
│   │   └── common.yaml       # Reusable query params
│   ├── responses/
│   │   └── errors.yaml       # Standard error responses
│   └── securitySchemes/
│       └── apiKey.yaml       # Bearer token auth
└── paths/
    ├── policies.yaml         # /v1/policies endpoints
    ├── evaluate.yaml         # /v1/evaluate endpoints
    └── internal.yaml         # /internal/v1/* endpoints
```

### OpenAPI 3.1 Template

```yaml
openapi: 3.1.0
info:
  title: Entitle API
  version: 1.0.0
  description: |
    Feature Enablement as a Service (FEaaS) - Policy Decision Point API
    
    ## Authentication
    All requests require an API key in the `Authorization` header:
    ```
    Authorization: Bearer ent_live_yourApiKey
    ```
    
    ## Rate Limits
    - Evaluation: 100 req/s
    - Policy Management: 50 req/s
    - Admin: 10 req/s
    
    ## Environments
    - Production: https://api.entitle.io
    - Staging: https://api-staging.entitle.io
  contact:
    name: Entitle Support
    email: support@entitle.io
    url: https://docs.entitle.io
  license:
    name: Proprietary

servers:
  - url: https://api.entitle.io
    description: Production
  - url: https://api-staging.entitle.io
    description: Staging
  - url: http://localhost:8080
    description: Local Development

security:
  - bearerAuth: []

paths:
  /v1/evaluate:
    $ref: './paths/evaluate.yaml#/evaluate'
  
  /v1/evaluate/batch:
    $ref: './paths/evaluate.yaml#/evaluateBatch'
  
  /v1/policies:
    $ref: './paths/policies.yaml#/policies'
  
  /v1/policies/{policy_id}:
    $ref: './paths/policies.yaml#/policyById'
  
  /v1/policies/{policy_id}/activate:
    $ref: './paths/policies.yaml#/activatePolicy'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: API Key
      description: |
        API key authentication. Format: `ent_{env}_{random}`
        Example: `ent_live_a8Xk9PmN2vQ7wRyT4sU6`

  schemas:
    Error:
      type: object
      required:
        - error
      properties:
        error:
          type: object
          required:
            - code
            - message
            - request_id
            - timestamp
          properties:
            code:
              type: string
              enum:
                - INVALID_REQUEST
                - AUTHENTICATION_FAILED
                - AUTHORIZATION_FAILED
                - RESOURCE_NOT_FOUND
                - RATE_LIMIT_EXCEEDED
                - VALIDATION_FAILED
                - INTERNAL_ERROR
                - DATABASE_ERROR
                - UPSTREAM_TIMEOUT
            message:
              type: string
            details:
              type: object
              additionalProperties: true
            request_id:
              type: string
            timestamp:
              type: string
              format: date-time

    EvaluateRequest:
      type: object
      required:
        - plan_key
        - capability_id
        - environment
      properties:
        plan_key:
          type: string
          example: "enterprise"
          description: Plan identifier
        capability_id:
          type: string
          example: "advanced_analytics"
          description: Feature identifier to check
        environment:
          type: string
          enum: [production, staging, development]
          example: "production"
        context:
          type: object
          additionalProperties: true
          description: Optional metadata for logging/future rules
          example:
            user_id: "user_123"
            request_ip: "203.0.113.42"

    EvaluateResponse:
      type: object
      required:
        - allowed
        - reason
        - policy_version
        - request_id
        - timestamp
      properties:
        allowed:
          type: boolean
          example: true
        reason:
          type: string
          example: "capability enabled in plan"
        policy_version:
          type: integer
          example: 3
        request_id:
          type: string
          example: "req_a8Xk9PmN2vQ7"
        timestamp:
          type: string
          format: date-time
          example: "2026-01-15T10:30:45Z"
        ttl:
          type: integer
          description: Cache validity in seconds
          example: 300

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    Unauthorized:
      description: Authentication failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    RateLimitExceeded:
      description: Rate limit exceeded
      headers:
        Retry-After:
          schema:
            type: integer
          description: Seconds to wait before retrying
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    InternalError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
```

---

## Request/Response Standards

### Content Negotiation

**Accept Header:**
```http
Accept: application/json
```

**MVP:** JSON only. No XML, protobuf, or other formats.

**v2.0+:** Consider gRPC for high-throughput use cases.

### Timestamps

**Format:** ISO 8601 with timezone (RFC 3339)
```json
"timestamp": "2026-01-15T10:30:45Z"
```

**Always UTC** - no timezone offsets. Clients convert to local time.

### Pagination

**Query Parameters:**
- `page`: Page number (1-indexed, default 1)
- `page_size`: Results per page (default 50, max 1000)

**Response:**
```json
{
  "data": [...],
  "total": 1847,
  "page": 1,
  "page_size": 50,
  "total_pages": 37
}
```

**Alternative (Cursor-Based for Large Datasets in v2):**
```json
{
  "data": [...],
  "next_cursor": "eyJpZCI6MTIzfQ==",
  "has_more": true
}
```

### Sorting

**Query Parameter:**
```
?sort=created_at:desc,name:asc
```

**Format:** `field:direction,field:direction`

**Defaults:**
- Policies: `created_at:desc`
- Audit logs: `timestamp:desc`

### Filtering

**Query Parameters (field-specific):**
```
?environment=production&status=ACTIVE&plan_key=enterprise
```

**Complex Filters (v2.0+):**
```
?filter=plan_key eq 'enterprise' and status eq 'ACTIVE'
```

### Idempotency

**Idempotency Key Header (for POST requests):**
```http
Idempotency-Key: uuid-or-client-generated-key
```

**Behavior:**
- Server stores request result for 24 hours
- Duplicate requests (same key) return cached response
- Prevents duplicate policy creation, audit log entries

**MVP:** Optional. Implement if time permits (Week 5).

---

## Caching Strategy

### Client-Side Caching

**Evaluation Response:**
```http
Cache-Control: private, max-age=300
ETag: "v3-enterprise-production"
```

**Client behavior:**
- Cache evaluation results for 5 minutes (300s)
- Use `If-None-Match` header with ETag for conditional requests
- Server returns 304 Not Modified if policy unchanged

**Example:**
```http
GET /v1/policies/pol_123
If-None-Match: "v3-enterprise-production"

Response: 304 Not Modified (no body)
```

### Server-Side Caching

**Policy Cache (in-memory):**
- Key: `tenant_id:plan_key:environment`
- TTL: 5 minutes
- Invalidation: On policy activation/deactivation

**Cache Headers:**
```http
X-Cache: HIT
X-Cache-TTL: 287
```

### CDN/Edge Caching (v2.0+)

- Use Cloudflare Workers or AWS CloudFront
- Cache evaluation responses at edge (reduce latency to <10ms globally)
- Requires careful cache key design (tenant-specific)

---

## Webhook Support (Future, v2.0+)

### Event Types

- `policy.activated` - New policy went live
- `policy.deactivated` - Policy disabled
- `tenant.created` - New tenant onboarded
- `tenant.api_key.rotated` - API key changed

### Webhook Payload

```json
{
  "event_id": "evt_uuid123",
  "event_type": "policy.activated",
  "timestamp": "2026-01-15T10:50:00Z",
  "data": {
    "policy_id": "pol_newPolicy123",
    "plan_key": "enterprise",
    "version": 4,
    "environment": "production"
  }
}
```

### Security

- HMAC signature in `X-Webhook-Signature` header
- Verify signature before processing
- Retry failed webhooks with exponential backoff (3 attempts)

---

## SDK Examples

### Node.js/TypeScript SDK

```typescript
import { EntitleClient } from '@entitle/sdk';

const client = new EntitleClient({
  apiKey: 'ent_live_a8Xk9PmN2vQ7wRyT4sU6',
  environment: 'production', // or 'staging'
});

// Single evaluation
const decision = await client.evaluate({
  planKey: 'enterprise',
  capabilityId: 'advanced_analytics',
  environment: 'production',
  context: {
    userId: 'user_123',
  },
});

if (decision.allowed) {
  console.log('Feature enabled!');
} else {
  console.log('Feature disabled:', decision.reason);
}

// Batch evaluation
const results = await client.evaluateBatch({
  planKey: 'enterprise',
  environment: 'production',
  capabilities: ['feature_a', 'feature_b', 'feature_c'],
});

results.results.forEach((r) => {
  console.log(`${r.capabilityId}: ${r.allowed}`);
});
```

### Python SDK

```python
from entitle_sdk import EntitleClient

client = EntitleClient(
    api_key='ent_live_a8Xk9PmN2vQ7wRyT4sU6',
    environment='production'
)

# Single evaluation
decision = client.evaluate(
    plan_key='enterprise',
    capability_id='advanced_analytics',
    environment='production',
    context={'user_id': 'user_123'}
)

if decision.allowed:
    print('Feature enabled!')
else:
    print(f'Feature disabled: {decision.reason}')

# Batch evaluation
results = client.evaluate_batch(
    plan_key='enterprise',
    environment='production',
    capabilities=['feature_a', 'feature_b', 'feature_c']
)

for result in results.results:
    print(f'{result.capability_id}: {result.allowed}')
```

### Java SDK

```java
import io.entitle.sdk.EntitleClient;
import io.entitle.sdk.models.EvaluateRequest;
import io.entitle.sdk.models.EvaluateResponse;

EntitleClient client = new EntitleClient.Builder()
    .apiKey("ent_live_a8Xk9PmN2vQ7wRyT4sU6")
    .environment("production")
    .build();

EvaluateRequest request = EvaluateRequest.builder()
    .planKey("enterprise")
    .capabilityId("advanced_analytics")
    .environment("production")
    .context(Map.of("userId", "user_123"))
    .build();

EvaluateResponse decision = client.evaluate(request);

if (decision.isAllowed()) {
    System.out.println("Feature enabled!");
} else {
    System.out.println("Feature disabled: " + decision.getReason());
}
```

---

## Performance Optimization Guidelines

### Minimize Latency

1. **Use Batch Evaluation:** Check multiple capabilities in one request
2. **Cache Aggressively:** Client-side cache for 5+ minutes
3. **Use Conditional Requests:** Send `If-None-Match` with ETag
4. **Compress Responses:** `Accept-Encoding: gzip` (automatic in SDKs)
5. **Connection Pooling:** Reuse HTTP connections (SDK handles this)

### Expected Performance

| Scenario | P50 Latency | P95 Latency | P99 Latency |
|----------|-------------|-------------|-------------|
| **Cached (Client)** | 0ms | 0ms | 0ms |
| **Cached (Server)** | 5ms | 15ms | 25ms |
| **Uncached (DB Query)** | 20ms | 80ms | 150ms |
| **Batch (10 capabilities)** | 25ms | 90ms | 180ms |

**Goal:** 95%+ cache hit rate → P95 < 20ms for most requests.

---

## Security Considerations

### API Key Best Practices

**Do:**
- Store API keys in environment variables
- Rotate keys every 90 days
- Use different keys for staging/production
- Revoke keys immediately if compromised

**Don't:**
- Commit API keys to Git
- Embed keys in client-side JavaScript
- Share keys across teams/applications
- Log API keys (mask in logs)

### Request Validation

**All Inputs Validated:**
- JSON schema validation (malformed JSON rejected)
- Field-level validation (required fields, types, lengths)
- Business logic validation (e.g., plan_key exists)
- SQL injection prevention (parameterized queries via sqlc)
- XSS prevention (no HTML rendering in API)

### TLS Requirements

- **TLS 1.3 only** (disable TLS 1.0, 1.1, 1.2 if possible)
- **Perfect Forward Secrecy** (ephemeral key exchange)
- **Certificate Pinning** (optional, SDKs can verify Entitle cert)

### CORS Policy

**Allowed Origins:**
- MVP: No CORS (backend-to-backend API only)
- v2.0: Whitelist customer domains if browser access needed

### DDoS Protection

- **Rate Limiting:** Enforced per-tenant (100 req/s default)
- **API Gateway:** Use Cloudflare, AWS API Gateway, or Kong
- **Anomaly Detection:** Alert on >10x baseline traffic (future)

---

## API Governance

### Change Management Process

1. **Propose Change:** RFC document in GitHub (design review)
2. **Update OpenAPI Spec:** PR with spec changes
3. **Review:** API guild reviews for breaking changes
4. **Approve:** Merge if non-breaking, defer to v2 if breaking
5. **Generate SDKs:** Re-run openapi-generator
6. **Publish SDKs:** Version bump, publish to npm/PyPI/Maven
7. **Notify Customers:** Changelog, email, Slack #announcements

### Deprecation Policy

**Timeline:**
- **Announce:** 90 days before deprecation
- **Warn:** Add `Deprecation` header to responses
- **Remove:** After 180 days minimum

**Example:**
```http
HTTP/1.1 200 OK
Deprecation: Sun, 01 Jun 2026 00:00:00 GMT
Sunset: Sat, 01 Dec 2026 00:00:00 GMT
Link: <https://docs.entitle.io/migration/v2>; rel="sunset"
```

### Monitoring & SLAs

**API Health Metrics:**
- **Availability:** 99.9% uptime (8.76 hours downtime/year)
- **Latency:** P95 < 100ms (MVP), P95 < 10ms (v2.0)
- **Error Rate:** <0.1% (5xx errors)
- **Success Rate:** >99.9% (non-4xx responses)

**Alerting:**
- P95 latency >200ms for 5 minutes → page on-call
- Error rate >1% for 5 minutes → page on-call
- Database connection pool exhausted → page on-call

---

## Testing Strategy

### Contract Testing

**Use OpenAPI Spec as Source of Truth:**
- Generate test cases from OpenAPI spec
- Validate responses match schema
- Catch breaking changes before deployment

**Tools:**
- Prism (mock server from OpenAPI spec)
- Dredd (API contract testing)
- Postman collections (manual testing)

### Example Test Cases

**Evaluate Endpoint:**
```gherkin
Scenario: Evaluate allowed capability
  Given tenant "acme" with plan "enterprise"
  And policy allows capability "advanced_analytics"
  When client calls POST /v1/evaluate with capability "advanced_analytics"
  Then response status is 200
  And response.allowed is true
  And response.policy_version is 3

Scenario: Evaluate disallowed capability
  Given tenant "acme" with plan "free"
  And policy does not allow capability "advanced_analytics"
  When client calls POST /v1/evaluate with capability "advanced_analytics"
  Then response status is 200
  And response.allowed is false
  And response.reason is "capability not included in plan"

Scenario: Invalid API key
  Given invalid API key "invalid_key"
  When client calls POST /v1/evaluate
  Then response status is 401
  And response.error.code is "AUTHENTICATION_FAILED"
```

### Load Testing

**Target:** 1000 req/s sustained, 10,000 req/s burst

**Tool:** `hey` or `k6`

```bash
# Test evaluate endpoint
hey -n 100000 -c 100 -m POST \
  -H "Authorization: Bearer ent_test_key" \
  -H "Content-Type: application/json" \
  -d '{"plan_key":"enterprise","capability_id":"feature_a","environment":"production"}' \
  http://localhost:8080/v1/evaluate
```

**Acceptance Criteria:**
- P95 latency < 100ms under 1000 req/s load
- 0 errors (0% failure rate)
- CPU < 70%, Memory < 80%

---

## Documentation Standards

### API Reference

Auto-generated from OpenAPI spec using:
- **Redoc** (clean, three-column layout)
- **Swagger UI** (interactive, try-it-out)
- **Postman Collection** (import-and-run)

**Hosted at:** https://docs.entitle.io/api

### Quick Start Guide

```markdown
# Quick Start

## 1. Get API Key
Contact support@entitle.io for onboarding (MVP: manual process)

## 2. Install SDK
```bash
npm install @entitle/sdk
```

## 3. Evaluate Feature
```typescript
import { EntitleClient } from '@entitle/sdk';

const client = new EntitleClient({ apiKey: process.env.ENTITLE_API_KEY });
const decision = await client.evaluate({
  planKey: 'enterprise',
  capabilityId: 'advanced_analytics',
  environment: 'production',
});

console.log(decision.allowed); // true or false
```

## 4. Handle Result
```typescript
if (decision.allowed) {
  // Enable feature in your app
} else {
  // Show upgrade prompt or disable feature
}
```
```

---

## Changelog Template

### v1.0.0 (Week 9 - MVP Launch)

**Added:**
- `POST /v1/evaluate` - Core decision evaluation
- `POST /v1/evaluate/batch` - Batch evaluation
- `GET /v1/policies` - List policies
- `POST /v1/policies` - Create policy
- `POST /v1/policies/:id/activate` - Activate policy
- Internal admin endpoints for tenant management

**Notes:**
- Initial release, API subject to change before v1.1

---

## API Contract Checklist (Week 0 Deliverables)

- [ ] OpenAPI 3.1 spec written (`api/openapi.yaml`)
- [ ] All endpoints documented with request/response examples
- [ ] Error codes defined and documented
- [ ] Authentication flow documented
- [ ] Rate limits specified
- [ ] Validation rules defined
- [ ] Prism mock server running (`prism mock api/openapi.yaml`)
- [ ] Postman collection generated and tested
- [ ] SDK generation verified (Node.js, Python, Java)
- [ ] API reference docs generated (Redoc)
- [ ] Team review completed, spec frozen

**Freeze Date:** End of Week 0 (no changes without approval after this point)

---

## Next Steps

1. **Week 0:** Write OpenAPI spec (this document guides it)
2. **Week 1:** Implement `/health` and `/v1/evaluate` (stub)
3. **Week 2-3:** Complete Policy Management endpoints
4. **Week 4-5:** Audit logging, metrics, load testing
5. **Week 6-7:** Generate and publish SDKs
6. **Week 8:** Internal admin UI integration
7. **Week 9:** Alpha customer onboarding

**Questions?** Open GitHub issue or Slack #api-design.
