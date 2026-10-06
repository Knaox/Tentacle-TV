# Installing Tentacle

*Version française : [fr/install.md](fr/install.md).*

## Which stack?

| Stack | Contains | Choose it when |
|---|---|---|
| **tentacle-full** (recommended) | Tentacle, its database, **Jellyfin** | you start from scratch, or want everything in one place |
| **tentacle-db** | Tentacle and its database | Jellyfin already runs elsewhere (NAS, another container, native install) |
| **tentacle-only** | Tentacle alone | you already have MariaDB/MySQL and Jellyfin |

Each stack is a single `compose.yaml`, ready to copy, with a commented `.env.example` next to it. **Nothing is
mandatory in `.env`**: every value has a working default.

```bash
mkdir tentacle && cd tentacle
# pick ONE of the three:
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-db/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-only/compose.yaml
docker compose up -d
```

## First start: the setup code

```bash
docker compose logs tentacle
```

prints a block like:

```
  Tentacle — setup code / code d'installation : ABCD-EFGH-JKMN
  http://<this-server>:3000/setup#code=ABCD-EFGH-JKMN
```

Open the link (replace `<this-server>` with the machine's address) — the code is filled in for you. It is
single-use and also written to `data/setup-token.txt` in the data volume. Lost or used? Get a new one:

```bash
docker compose exec tentacle tentacle setup token
```

## The wizard, step by step

One question per screen; the steps adapt to the stack it detects.

1. **Welcome** — language.
2. **Setup code.**
3. **Database** — *tentacle-only* only: host, port, database, account. From Docker, `localhost` is Tentacle
   itself: use `host.docker.internal` or the machine's address.
4. **Jellyfin** —
   - *tentacle-full*: the Jellyfin next to Tentacle was **locked at startup** (nobody else can claim it); the
     wizard configures it with the account you choose next;
   - *tentacle-db / tentacle-only*: give Jellyfin's address. Brand new → Tentacle configures it; already set
     up → sign in with its administrator account (Tentacle creates its API key itself), or paste an API key.
5. **Account** — the administrator account of Jellyfin, which is also Tentacle's.
6. **Metadata language and country.**
7. **Libraries** — *tentacle-full* proposes **Movies** (`/media/films`) and **Shows** (`/media/series`); browse
   Jellyfin's folders to add others.
8. **Summary**, then **setup** (each failed step can be retried on its own).
9. **Remote access** (optional) — see [remote-access.md](remote-access.md).
10. **What's next?** — where to drop your files, the apps for each platform, a QR code to open the server.

## Settings (`.env`)

Copy `.env.example` to `.env` next to `compose.yaml`, uncomment what you need, then `docker compose up -d`.

| Variable | Default | |
|---|---|---|
| `MEDIA_PATH` | `./media` | *full*: your media folder on this machine (Jellyfin sees it as `/media`) |
| `TENTACLE_PORT` | `3000` | Tentacle's port on this machine |
| `JELLYFIN_PORT` | `8096` | *full*: Jellyfin's port on this machine |
| `JELLYFIN_DISCOVERY_PORT` | `7359` | *full*: Jellyfin's UDP discovery port (change it if another Jellyfin runs here) |
| `PUID` / `PGID` | `1000` | the account owning your files (`id -u`, `id -g`) |
| `TZ` | `Europe/Paris` | time zone |
| `TENTACLE_VERSION` | `latest` | pin a version (e.g. `v1.23.0`) to update only when you decide |
| `TENTACLE_DOMAIN`, `JELLYFIN_DOMAIN` | — | *full*: domains for the `caddy` / `traefik` profiles ([remote-access.md](remote-access.md)) |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | *full*: ports of the reverse proxy profile |

Server variables you may set in `compose.yaml` (`environment:`) for special cases:

| Variable | |
|---|---|
| `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` / `DB_PASSWORD_FILE` | the database, given by the environment instead of the wizard |
| `TENTACLE_PUBLIC_URL` | fallback public link (the one set in the administration wins) |
| `TRUSTED_PROXIES` | extra proxies whose `X-Forwarded-For` is trusted (comma-separated IPs/CIDRs) — see [remote-access.md](remote-access.md#trusted-proxies) |
| `REMOTE_CHECK_URL` | remote access test service (`off` to disable) |

## Podman

The stacks work with `podman compose` (or `podman-compose`). The media volume carries `:z` for SELinux.
Rootless: add `userns_mode: keep-id` to the `jellyfin` and `tentacle` services so files keep your ownership.
Hardware transcoding with Podman: see [gpu.md](gpu.md#podman).

## Without Docker

Tentacle also runs natively (`node apps/backend/dist/index.js` from a build). With no Jellyfin on the
machine, the wizard shows Jellyfin's official install command (Debian/Ubuntu) or its official guide, then
waits for Jellyfin to answer on `http://127.0.0.1:8096`. The Docker stacks remain the supported path.
