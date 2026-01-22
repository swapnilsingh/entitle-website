# mTLS Authentication Setup

This guide explains how to set up mutual TLS (mTLS) authentication for the Entitle API, providing the highest level of security for client connections.

## Overview

mTLS authentication uses client certificates to verify both the client and server identity. This is ideal for:
- Cloudflare Tunnel deployments
- High-security environments
- SDK-to-API communications
- Eliminating credential management in client code

## Certificate Generation

Use the provided script to generate all necessary certificates:

```bash
./scripts/generate-mtls-certs.sh
```

This creates:
- `certs/ca.crt` - Certificate Authority certificate
- `certs/ca.key` - Certificate Authority private key
- `certs/server.crt` - Server certificate
- `certs/server.key` - Server private key
- `certs/client.crt` - Client certificate (with tenant ID in CN)
- `certs/client.key` - Client private key

## Certificate Structure

Client certificates must include the tenant ID in the Common Name (CN) field:

```
CN=tenant:11111111-1111-1111-1111-111111111111
```

## Server Configuration

### Environment Variables

Set these environment variables on your server:

```bash
TLS_CERT_FILE=/path/to/server.crt
TLS_KEY_FILE=/path/to/server.key
TLS_CA_CERT_FILE=/path/to/ca.crt
```

### Docker Deployment

Update your `docker-compose.yml`:

```yaml
api:
  environment:
    - TLS_CERT_FILE=/app/certs/server.crt
    - TLS_KEY_FILE=/app/certs/server.key
    - TLS_CA_CERT_FILE=/app/certs/ca.crt
  volumes:
    - ./certs:/app/certs:ro
```

## Client Usage

### cURL Example

```bash
curl --cert ./certs/client.crt \
     --key ./certs/client.key \
     --cacert ./certs/ca.crt \
     https://api.avasc.in/v1/evaluate \
     -d '{"capability_id":"read","environment":"production","context":{}}' \
     -H 'Content-Type: application/json'
```

### SDK Integration

For SDKs, configure the HTTP client to use client certificates:

```typescript
// Node.js example
import * as https from 'https';
import * as fs from 'fs';

const agent = new https.Agent({
  cert: fs.readFileSync('./certs/client.crt'),
  key: fs.readFileSync('./certs/client.key'),
  ca: fs.readFileSync('./certs/ca.crt')
});

const config = new Configuration({
  basePath: 'https://api.avasc.in',
  fetchApi: (url, init) => fetch(url, { ...init, agent })
});
```

## Authentication Priority

The API supports multiple authentication methods with this priority:

1. **mTLS Certificate** (highest security - recommended for production)
2. **JWT Bearer Token** (good for SDKs, short-lived)
3. **API Key** (fallback, requires secure storage)

## Certificate Management

### Renewal

1. Generate new certificates using the script
2. Update server configuration
3. Distribute new client certificates to users
4. Restart the API server

### Revocation

To revoke a client certificate:
1. Remove the certificate from the CA trust store
2. Update the server configuration
3. Restart the API server

### Multiple Tenants

For multiple tenants, generate separate client certificates:

```bash
# Generate cert for tenant 22222222-2222-2222-2222-222222222222
CLIENT_CN="tenant:22222222-2222-2222-2222-222222222222"
```

## Security Benefits

- **No credentials in code**: Certificates eliminate API keys in client applications
- **Mutual authentication**: Both client and server verify each other
- **Certificate pinning**: Built-in protection against MITM attacks
- **Cloudflare Tunnel friendly**: Works perfectly with Cloudflare's certificate handling

## Troubleshooting

### Certificate Verification Errors

Check:
- Certificate validity dates
- Correct CN/SAN fields
- CA certificate is properly loaded
- Client certificate is signed by the CA

### Connection Refused

Ensure:
- Server is configured for TLS (environment variables set)
- Certificates are readable by the application
- Correct certificate file paths

### Local Development Testing

For local testing with certificates issued for production domains:

```bash
# Use --insecure to bypass hostname verification
curl --insecure \
     --cert ./certs/client.crt \
     --key ./certs/client.key \
     --cacert ./certs/ca.crt \
     https://localhost:8080/v1/evaluate \
     -d '{"capability_id":"read","environment":"production","context":{}}' \
     -H 'Content-Type: application/json'
```

### Authentication Fails

Verify:
- Client certificate CN contains `tenant:` prefix
- Tenant ID in certificate matches a valid tenant
- Certificate is not expired