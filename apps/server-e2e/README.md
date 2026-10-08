# Tentacle — server end-to-end bench

Real Docker stacks (`stacks/tentacle-*`), real Jellyfin, the system's Chrome (headless, nothing downloaded).
**Never run by `pnpm test`** — only by:

```bash
pnpm --filter @tentacle-tv/server-e2e test:e2e
```

| File | What it proves |
|---|---|
| `fullStack.e2e.ts` | full stack, blank Jellyfin 12: the wizard driven in Chrome from the logs' code to the home page; closed for good afterwards; a movie dropped in the media folder is found after a scan |
| `existingJellyfin.e2e.ts` | Tentacle-only stack (its SQLite database) in front of an already set up Jellyfin (10.11 and 12.1): session, brute force (429), single-use code, SSRF refusals (cloud metadata, `file:`, `localhost`, redirect), wrong password / API key, Jellyfin stopped mid-way then resumed, library created, no API key nor password in any response or log, closed at the end |
| `rightJellyfin.e2e.ts` | a Portainer-like full stack (Tentacle 47300, its Jellyfin published on 47896) next to two other Jellyfin (set up on 8096, blank on 8097), its database taken over from a first try (a Tentacle-only stack linked to the 8096 one, same `tentacle-data` volume): the stack's own Jellyfin is kept, the foreign one forgotten; the apps' Jellyfin address is the browser's host + the published port; a home-network device (a container on the stack network) opens the wizard **without a code**, a second one gets `setup_in_progress`, a public address / public domain / proxied public client gets `code_required`, the host (through the engine's port relay: colima's gateway, rootless Podman's rootlessport) needs the code. `E2E_OLD_TENTACLE_VERSION=wiz-local` also proves the old image kept the wrong Jellyfin |
| `discovery.e2e.ts` | Tentacle-only stack on a machine with two Jellyfin (set up on 8096, blank on 8097): both listed once, the blank one first, the apps' address uses the browser's host (never the Docker gateway's IP), the blank one configured, the other untouched |
| `jellyfinChoice.e2e.ts` | a full stack next to an already set up Jellyfin (8096: two libraries, English metadata) and a new one (8097): the wizard lists all three — the stack's own first (locked, shown as new), then the new one, then the set up one, each once; in Chrome, the set up one is chosen: its existing account, the libraries left untouched (none created), the recommended settings screen (English kept unticked), only the ticked one applied (previews), skip detection and monitoring left off; the stack's Jellyfin stays locked. A second full stack: its new Jellyfin, the complete path (account, Movies and Shows, skip detection). Screenshots in `E2E_PROOF_DIR` |
| `setupPathConfigured.e2e.ts` | the **already set up** path in Chrome, on the stack that showed the bug: a full stack whose Jellyfin was set up by a first try, then the wizard reopened (`tentacle setup reset`). The Jellyfin step comes first, nothing ticked, every step before the choice refused by the server; then sign-in and recommended settings only — no account or library screen, and the server refuses to create either (direct calls from the page); going back only climbs this path's screens. The exact list of screens (title + "Step n of t") and the chosen Jellyfin shown on each. Jellyfin ends with no extra account nor library |
| `setupPathFresh.e2e.ts` | the **new** path in Chrome, with no Jellyfin in the stack (Tentacle-only stack) next to an already set up one: "Salon" picked first (sign-in, recommended settings), then back to the choice and the new one picked — the path is recomputed, "Salon" dropped (its "Tentacle" key revoked, nothing changed there); account created, a real Jellyfin library created through the folder browser, going back never recreates the account; the exact list of screens. Screenshots of every screen in `E2E_PROOF_DIR` |
| `setupV3.e2e.ts` | the v3 wizard in Chrome, on a Portainer-like full stack opened through the **machine's LAN address** (Tentacle 47330, its Jellyfin 47910), next to "Salon" (set up, with libraries, 8096) and a new Jellyfin (8097). A — the stack's Jellyfin set up by a first try but **without any library** (Damien's case): after sign-in, the libraries screen (optional, "Skip"), its `/media` shown with the server's folder (`MEDIA_PATH`), the folder browser, real libraries created; remote access with **nothing published while no public link is set** and no switch, then "Learn more" (two diagrams, the LAN address pre-filled, detected public address, both ports with their real numbers, "neither included nor installed" proxies); the "add content" tutorial with the server's folder; "Need help?" opened. B — "Salon": no libraries screen, creation refused. C — a new one: account, Movies and Shows proposed **without folders**, chosen in the browser; then the admin's remote access (public link used → `/api/config` publishes it; cleared and saved → no public address any more) and the old Services anchor (`#directstreaming`) leading to the addresses form. Last, `tentacle web off` → 404 on the web, API alive; `tentacle web on` → back without restart. Exact screen lists (10 screens for A, 9 for B) |
| `segmentPlugins.e2e.ts` | skip detection: the wizard installs Intro Skipper, TheIntroDB and SkipMe.db, restarts Jellyfin through its API and turns Intro Skipper's audio analysis off — on a full stack's blank Jellyfin 12 and on an existing Jellyfin 10.11 (where GitHub raw is cut off from Jellyfin: TheIntroDB is reported offline, the rest goes on, a second run completes it); the admin's "Install / repair"; the one-time migration of an older server (Tentacle's audio analysis and Intro Skipper's) and the admin's later choice kept across restarts |
| `proxies.e2e.ts` | the user's own reverse proxy, simulated: a Caddy or a Traefik from the bench's [`proxies/compose.yaml`](proxies/compose.yaml) (the stacks ship none), fed with the exact snippets the admin page generates, targeting the published ports — HTTPS to Tentacle, a single CORS header to Jellyfin (preflight included), port 80 redirecting to HTTPS |

Environment:

| Variable | Default | |
|---|---|---|
| `E2E_TENTACLE_VERSION` | `latest` | image tag under test (e.g. a local build: `wiz-local`) |
| `E2E_COMPOSE` | `docker compose` | the compose command (e.g. `/opt/homebrew/lib/docker/cli-plugins/docker-compose`) |
| `E2E_JELLYFIN_TAGS` | `10.11,12.1` | Jellyfin versions for the "existing Jellyfin" scenario |
| `E2E_CHROME` | system Chrome | another browser executable |
| `E2E_KEEP` | — | `1`: keep the stacks for inspection |
| `DOCKER_HOST` | — | e.g. colima: `unix://$HOME/.colima/default/docker.sock`; rootless Podman: `unix:///run/user/$(id -u)/podman/podman.sock` |
| `E2E_HOST_ADDRESS` | `host.docker.internal` | the name a stack container reaches the host by (where the bench publishes its other Jellyfin) |
| `E2E_LAN_IP` | deduced | the machine's LAN address (`setupV3`): `en0`/`en1` on macOS, the default route's interface on Linux |
| `E2E_HOST_CODE` | asked to Tentacle | `required` or `none`: whether the wizard asks the host's browser for its code. The browser journeys assume it does (every engine above hides the host's address) and stop at once, saying so, when it does not |

Ports used (disjoint, so `E2E_KEEP=1` stacks never collide): 3481–3502, 3592–3602, 7361–7364, 8447–8448,
8484–8485, 8981–9002; `segmentPlugins`: 3511, 3521, 7371, 9011, 9021 (containers `pass-e2e-*`); `rightJellyfin` and `discovery`: 8096–8097, 47300–47301, 47359, 47896 (containers
`asst-*`, removed at the end); `jellyfinChoice`: 8096–8097, 47310–47311, 47361–47362, 47898–47899 (containers `ajf-*`); `setupPath*`: 8096–8097, 47320–47321, 47364, 47900 (containers `ap-*`); `setupV3`: 8096–8097, 47330, 47366, 47910 (containers `av3-*`). Working folders live in
`apps/server-e2e/.runs/` (git-ignored): colima only mounts the home folder.

Engines (`src/benchHost.ts`):

- **macOS + colima** (Damien's machine): the defaults.
- **Linux + rootless Podman** (5.8, measured on 2026-10-08): `docker` must be `podman` (a two-line shim in the
  `PATH`: `exec podman "$@"`), `E2E_COMPOSE=docker-compose` with `DOCKER_HOST` on Podman's socket, `E2E_CHROME`
  on a Chrome or Chromium. `host.docker.internal` leads to `169.254.1.2` there: the wizard accepts it under that
  name only (`hostGateway.ts`); and rootlessport shows every visitor as the container's own address, so the host's
  browser gets the code, as with colima.
- **Linux + Docker with root**: the defaults; the host's browser comes through Docker's relay (the gateway) and
  gets the code. Not run yet.

The real test from outside (4G) needs the deployed check service: see [REAL-TEST.md](REAL-TEST.md).
