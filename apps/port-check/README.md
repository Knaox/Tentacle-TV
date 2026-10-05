# Tentacle — port-check

The external service behind Tentacle's **remote access test** (check.tentacletv.app — name to be confirmed).
A Tentacle server asks it "reach me from the outside"; the service answers what it saw. **No CI workflow builds
or deploys it**: it is deployed by hand.

Le service externe du **test d'ouverture** de Tentacle. Un serveur Tentacle lui demande « joins-moi de
l'extérieur » ; il répond ce qu'il a vu. **Aucun workflow ne le construit ni ne le déploie** : on le déploie à la main.

## What it does / Ce qu'il fait

- `POST /v1/check` — tests **only the requester's own address** (IPv4 or IPv6, whichever it connected with).
  It never accepts a target IP. A domain name is followed only if it resolves to that same address.
- Tentacle proves it is the one answering with a one-time challenge served under
  `/.well-known/tentacle-check/<id>`; Jellyfin with its server `Id` (`/System/Info/Public`).
- Ports: 80, 443, 3000, 8096, 8920 and 1024–49151; at most 4 targets per request.
- GET only, 5 s per target, no redirect followed, 4 KB read at most. Only a structured verdict comes back.
- One-time challenges (a replay is refused), strict rate limit per address (per /64 for IPv6),
  private/reserved source addresses refused, **no IP address in the logs**.

Protocol: `src/checkProtocol.ts` (mirror of `packages/shared/src/remoteAccess/checkProtocol.ts`).

## Run / Lancer

```bash
docker build -f apps/port-check/Dockerfile -t tentacle-port-check .
docker run --rm -p 8080:8080 tentacle-port-check
```

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | |
| `HOST` | `::` | IPv4 + IPv6 (falls back to `0.0.0.0`) |
| `TRUSTED_PROXIES` | — | Comma-separated IPs/CIDRs whose `X-Forwarded-For` is trusted (your load balancer). |
| `CHECKS_PER_WINDOW` / `WINDOW_MS` | `6` / `600000` | Rate limit per address. |
| `PROBE_TIMEOUT_MS` | `5000` | Per target. |
| `MAX_IN_FLIGHT` | `32` | Concurrent checks. |
| `ALLOW_NON_PUBLIC_SOURCES` | `false` | `true` only for a local test bench. |

The service must have **IPv6 connectivity** to test IPv6, and must be reachable over both families
(an `A` and an `AAAA` record). Tentacle servers point to it with `REMOTE_CHECK_URL` (`off` disables the test).
