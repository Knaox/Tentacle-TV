# Installing Tentacle

*Version française : [fr/install.md](fr/install.md).*

## Which stack?

| Stack | Contains | Choose it when |
|---|---|---|
| **tentacle-full** (recommended) | Tentacle, its database, **Jellyfin** | you start from scratch, or want everything in one place |
| **tentacle-db** | Tentacle and its database | Jellyfin already runs elsewhere (NAS, another container, native install) |
| **tentacle-only** | Tentacle alone | you already have MariaDB/MySQL and Jellyfin |

Each stack is a single `compose.yaml`, ready to copy, with a commented `.env.example` next to it. **Nothing is
mandatory in `.env`**: every value has a working default. No stack ships a reverse proxy: for HTTPS
from the Internet, put Tentacle behind yours ([remote-access.md](remote-access.md)).

```bash
mkdir tentacle && cd tentacle
# pick ONE of the three:
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-db/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-only/compose.yaml
docker compose up -d
```

## First start: open the wizard

Open `http://<this-machine>:3000` (or the port you chose). **From your home network, that's all**: the
first browser that reaches Tentacle directly from a private address (192.168.x.x, 10.x.x.x, 172.16-31.x.x,
IPv6 ULA…) claims the server, with no code — like Jellyfin or Plex. Another device then needs the code to
take over. What exactly counts as "directly", and why: [setup-security.md](setup-security.md).

## When the wizard asks for a code

From anywhere else — over the Internet, through a reverse proxy that forwards a public address, from a
public domain name, or when Tentacle can't see your real address (Docker Desktop, colima) — the wizard asks
for a one-time setup code, and shows where to read it. On every start until setup is done, Tentacle writes
it to **its container's log**. Read that log the way you manage containers:

| You use | Where to read the code |
|---|---|
| **Portainer** | *Containers* → the Tentacle container → **Logs** |
| a terminal (Docker, Podman) | `docker logs <container>` (or `podman logs <container>`) |
| Docker Compose | `docker compose logs tentacle` from the stack's folder (`tentacle` is the service name in the official stacks; use yours if you renamed it) |
| Synology, Unraid, another interface | the container's **Log** / **Logs** page |

`<container>` is the container's name or ID (`docker ps` lists them). The wizard's code screen shows this
container's ID and the exact commands, ready to copy. The log holds a block like:

```
  Tentacle — setup code / code d'installation : ABCD-EFGH-JKMN
  http://<this-server>:3000/setup#code=ABCD-EFGH-JKMN
```

Open the link (replace `<this-server>` with the machine's address) — the code is filled in for you. It is
single-use and also written to `data/setup-token.txt` in the data volume. Lost or used? Get a new one by
typing `tentacle setup token` in the container's console (Portainer: **Console** → *Connect*; Synology,
Unraid: the container's terminal), or from a terminal:

```bash
docker exec <container> tentacle setup token
```

## The wizard, step by step

One question per screen; the steps adapt to the stack it detects.

1. **Welcome** — language, then **Start**.
2. **Setup code** — only when the wizard asks for one (see above).
3. **Database** — *tentacle-only* only: host, port, database, account. From Docker, `localhost` is Tentacle
   itself: use `host.docker.internal` or the machine's address.
4. **Jellyfin** — the list of **all** the Jellyfin servers Tentacle found (Jellyfin's UDP discovery, then the
   machine you opened the wizard from and the container's gateway on the usual ports), grouped as **New** and
   **Already set up**, each with its name, address, port and version. From a Docker bridge network the
   discovery only sees this machine: Jellyfin on another device is entered by hand.
   - *tentacle-full*: the stack's own Jellyfin comes **first** ("In this stack") and is selected. It was
     **locked at startup** (nobody else can claim it) and is reached by its internal address. The others
     can still be chosen; if you pick another one, the stack's Jellyfin stays locked, unused;
   - elsewhere, the new one is selected for you; pick another, or enter an address.
5. **Account** — **New**: you create Jellyfin's administrator account (which is also Tentacle's), with the
   metadata language and country (suggested from your browser). **Already set up**: you sign in with an
   EXISTING administrator account (Tentacle creates its API key itself), or paste an API key; no account is
   created.
6. **Libraries** (new Jellyfin) — *tentacle-full* proposes **Movies** (`/media/films`) and **Shows**
   (`/media/series`); browse Jellyfin's folders to add others.
   **Recommended settings** (already set up Jellyfin, instead) — Tentacle creates **no** library; it lists the
   existing ones and offers, all **optional** and untickable, the settings the dashboard recommends too:
   skip detection (Intro Skipper, TheIntroDB, SkipMe.db), metadata language, seek bar previews, real-time
   monitoring, HEVC encoding (only with a hardware encoder). Each shows "currently → recommended"; what you
   set differently is never ticked for you. Only what is ticked is applied; **Skip** changes nothing.
7. **Summary**, with **the Jellyfin address for the apps** (direct play on your home network): built from the
   address you opened the wizard with and Jellyfin's published port (`JELLYFIN_PORT`), never a Docker name.
   Change it if needed. Then **setup** (each failed step can be retried on its own).
8. **Remote access** (optional) — HTTPS through your own reverse proxy: see [remote-access.md](remote-access.md).
9. **What's next?** — where to drop your files, the apps for each platform, a QR code to open the server.

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
