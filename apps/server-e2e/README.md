# Tentacle — server end-to-end bench

Real Docker stacks (`stacks/tentacle-*`), real Jellyfin, the system's Chrome (headless, nothing downloaded).
**Never run by `pnpm test`** — only by:

```bash
pnpm --filter @tentacle-tv/server-e2e test:e2e
```

| File | What it proves |
|---|---|
| `fullStack.e2e.ts` | full stack, blank Jellyfin 12: the wizard driven in Chrome from the logs' code to the home page; closed for good afterwards; a movie dropped in the media folder is found after a scan |
| `existingJellyfin.e2e.ts` | db stack in front of an already set up Jellyfin (10.11 and 12.1): session, brute force (429), single-use code, SSRF refusals (cloud metadata, `file:`, `localhost`, redirect), wrong password / API key, Jellyfin stopped mid-way then resumed, library created, no API key nor password in any response or log, closed at the end |
| `proxies.e2e.ts` | `caddy` and `traefik` profiles: HTTPS to Tentacle, a single CORS header to Jellyfin (preflight included), port 80 redirecting to HTTPS |

Environment:

| Variable | Default | |
|---|---|---|
| `E2E_TENTACLE_VERSION` | `latest` | image tag under test (e.g. a local build: `wiz-local`) |
| `E2E_COMPOSE` | `docker compose` | the compose command (e.g. `/opt/homebrew/lib/docker/cli-plugins/docker-compose`) |
| `E2E_JELLYFIN_TAGS` | `10.11,12.1` | Jellyfin versions for the "existing Jellyfin" scenario |
| `E2E_CHROME` | system Chrome | another browser executable |
| `E2E_KEEP` | — | `1`: keep the stacks for inspection |
| `DOCKER_HOST` | — | e.g. colima: `unix://$HOME/.colima/default/docker.sock` |

Ports used (disjoint, so `E2E_KEEP=1` stacks never collide): 3481–3502, 3592–3602, 7361–7364, 8447–8448,
8484–8485, 8981–9002. Working folders live in
`apps/server-e2e/.runs/` (git-ignored): colima only mounts the home folder.

The real test from outside (4G) needs the deployed check service: see [REAL-TEST.md](REAL-TEST.md).
