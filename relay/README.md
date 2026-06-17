# Tentacle TV Pairing Relay

A micro-relay Cloudflare Worker for zero-input TV pairing. Acts as a temporary pass-through between the Tentacle TV app and the user's phone/PC.

The relay stores normal pairing codes in Cloudflare KV with a 5-minute TTL. Admin-seeded *provisioning* codes (`/provision`) persist until their configured expiry date (KV `expirationTtl`) and are reusable. The relay cannot decode JWT tokens (it does not know each server's secret).

## Prerequisites

- A free Cloudflare account
- The domain `pair.tentacletv.app` pointed to Cloudflare DNS
- Node.js 18+

## Deployment

```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create the KV namespace
npx wrangler kv namespace create PAIRING_CODES
# Copy the returned ID into wrangler.toml (replace <FILL_AFTER_wrangler_kv_namespace_create>)

# Secret partagé pour le code de jumelage de provisionnement (doit être
# identique à RELAY_ADMIN_SECRET côté backend Tentacle)
npx wrangler secret put RELAY_ADMIN_SECRET

# Deploy
npx wrangler deploy
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /generate | No | Generate a 4-char pairing code (TTL 5min) |
| GET | /status/:code | No | Poll code status (pending/confirmed/expired) |
| POST | /confirm | No | Confirm a code with serverUrl + token + user |
| POST | /provision | `X-Relay-Admin-Secret` | Seed a persistent, pre-confirmed provisioning code (TTL = expiry date). Not deleted on read. |
| DELETE | /provision/:code | `X-Relay-Admin-Secret` | Remove a provisioning code (on disable/regenerate) |

## Rate Limits

- `/generate`: 10 requests per IP per hour
- `/confirm`: 20 requests per IP per hour

## Self-Hosting

The relay is deployed once by the Tentacle TV project maintainer. Users who self-host Tentacle TV do not need to deploy their own relay. If the relay is unreachable, the TV app falls back to manual server URL entry + local pairing.
