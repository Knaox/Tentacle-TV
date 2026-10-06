# The remote access test service (maintainers)

*Version française : [fr/port-check.md](fr/port-check.md).*

`apps/port-check` is the external service Tentacle servers call for **Administration › Remote access ›
Run the test**. **No CI workflow builds or deploys it**: it is deployed by hand, under `check.tentacletv.app`
(name to be confirmed). Until it is online, servers say "service unavailable" — never "closed".

## What it guarantees

- `POST /v1/check` tests **only the requester's own address** (IPv4 or IPv6, whichever it connected with); it
  accepts no target address. A domain is followed only if it resolves to that same address.
- Ports: 80, 443, 3000, 8096, 8920 and 1024–49151; four targets per request at most.
- GET only, 5 s per target, no redirect followed, 4 KB read at most; only a structured verdict comes back.
- One-time challenges (a replay is refused), rate limit per address (per /64 in IPv6), private/reserved source
  addresses refused (`source_not_public`), **no IP address in the logs**.
- Protocol: `apps/port-check/src/checkProtocol.ts`, mirror of `packages/shared/src/remoteAccess/checkProtocol.ts`.

## Build and run

```bash
docker build -f apps/port-check/Dockerfile -t tentacle-port-check .
docker run -d --restart unless-stopped -p 8080:8080 tentacle-port-check
```

Distroless, non-root, a single bundled file (~213 MB uncompressed, mostly Node). Variables: see
`apps/port-check/README.md` (`PORT`, `HOST`, `TRUSTED_PROXIES`, `CHECKS_PER_WINDOW`, `WINDOW_MS`,
`PROBE_TIMEOUT_MS`, `MAX_IN_FLIGHT`).

## Deployment checklist

1. A host with **public IPv4 and IPv6** (the service tests IPv6 only if it has IPv6 itself).
2. DNS: `A` **and** `AAAA` records for the service name.
3. HTTPS in front (Caddy, for instance) — then set `TRUSTED_PROXIES` to the proxy's address, otherwise every
   request seems to come from the proxy.
4. Never set `ALLOW_NON_PUBLIC_SOURCES=true` in production (local test benches only).
5. Point servers to it: `REMOTE_CHECK_URL=https://check.tentacletv.app` (that is the default).
6. Smoke test from a server: **Administration › Remote access › Run the test**.
