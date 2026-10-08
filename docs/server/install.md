# Installing Tentacle

*Version française : [fr/install.md](fr/install.md).*

## Which stack?

| Stack | Contains | Choose it when |
|---|---|---|
| **tentacle-full** (recommended) | Tentacle and **Jellyfin** | you start from scratch, or want everything in one place |
| **tentacle-only** | Tentacle alone | Jellyfin already runs elsewhere (NAS, another container, native install) |

No database to install, in either stack: since 1.25 Tentacle keeps its data in **one file**,
`data/tentacle.db` (SQLite), in its data volume — see [Database](#database). Updating an installation that
used MariaDB or MySQL (the old `tentacle-db` stack, a stack with a `db` service, `DATABASE_URL`…)? **Keep your
current file** — do not take these stacks yet — and update the image: Tentacle migrates its data by itself,
then the dashboard says when and how to move: [sqlite-migration.md](sqlite-migration.md).

Each stack is a single `compose.yaml`, ready to copy, with a commented `.env.example` next to it. **Nothing is
mandatory in `.env`**: every value has a working default. No stack ships a reverse proxy: for HTTPS
from the Internet, put Tentacle behind yours ([remote-access.md](remote-access.md)).

```bash
mkdir tentacle && cd tentacle
# pick ONE of the two:
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
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
3. **Jellyfin** — the list of **all** the Jellyfin servers Tentacle found (Jellyfin's UDP discovery, then the
   machine you opened the wizard from and the container's gateway on the usual ports), grouped as **New** and
   **Already set up**, each with its name, address, port and version. From a Docker bridge network the
   discovery only sees this machine: Jellyfin on another device is entered by hand.
   This step is **never skipped**, even with a single Jellyfin, and **nothing is picked for you**: a
   "Recommended" badge shows the one Tentacle suggests, you tick it yourself.
   - *tentacle-full*: the stack's own Jellyfin comes **first** ("In this stack"), recommended. It was
     **locked at startup** (nobody else can claim it) and is reached by its internal address. The others
     can still be chosen; if you pick another one, the stack's Jellyfin stays locked, unused;
   - elsewhere, the new one is recommended; pick the one you want, or enter an address.

   Your choice sets what follows — **two paths**, enforced by the server (it refuses any step outside the
   current path, whatever the browser does). The chosen Jellyfin stays shown at the top of each screen
   ("Jellyfin “Living room” · already set up"). Coming back to this step to pick another one recomputes
   the path; what was prepared for the previous one is dropped (an account already created on a Jellyfin
   stays there).
4. **New Jellyfin — your administrator account**: you create it (it is also Tentacle's), with the metadata
   language and country (suggested from your browser).
   **Already set up Jellyfin — sign in**: you sign in with an administrator account that EXISTS (Tentacle
   creates its API key itself). No account is created, neither here nor later.
5. **New Jellyfin — libraries**: real Jellyfin libraries, created in Jellyfin. *tentacle-full* proposes
   **Movies** (`/media/films`) and **Shows** (`/media/series`); browse Jellyfin's folders to add others.
   These are **Jellyfin's** paths, read through its API: Tentacle has no media setting, in any stack.
   **Already set up Jellyfin — recommended settings** (no libraries screen) — Tentacle creates **no** library; it lists the
   existing ones and offers, all **optional** and untickable, the settings the dashboard recommends too:
   skip detection (Intro Skipper, TheIntroDB, SkipMe.db), metadata language, seek bar previews, real-time
   monitoring, HEVC encoding (only with a hardware encoder). Each shows "currently → recommended"; what you
   set differently is never ticked for you. Only what is ticked is applied; **Skip** changes nothing.
6. **Summary**, with **the Jellyfin address for the apps** (direct play on your home network): built from the
   address you opened the wizard with and Jellyfin's published port (`JELLYFIN_PORT`), never a Docker name.
   Change it if needed. Then **setup** (each failed step can be retried on its own).
7. **Remote access** (optional) — HTTPS through your own reverse proxy: see [remote-access.md](remote-access.md).
8. **What's next?** — where to drop your files, the apps for each platform, a QR code to open the server.

## Settings (`.env`)

Copy `.env.example` to `.env` next to `compose.yaml`, uncomment what you need, then `docker compose up -d`.

| Variable | Default | |
|---|---|---|
| `MEDIA_PATH` | `./media` | *full*: your media folder on this machine. Only Jellyfin mounts it (it sees it as `/media`); `films` and `series` are created in it on first start if missing (`jellyfin-init` service) |
| `TENTACLE_PORT` | `3000` | Tentacle's port on this machine |
| `JELLYFIN_PORT` | `8096` | *full*: Jellyfin's port on this machine |
| `JELLYFIN_DISCOVERY_PORT` | `7359` | *full*: Jellyfin's UDP discovery port (change it if another Jellyfin runs here) |
| `PUID` / `PGID` | `1000` | the account owning your files (`id -u`, `id -g`) |
| `TZ` | `Europe/Paris` | time zone |
| `TENTACLE_VERSION` | `latest` | pin a version (e.g. `v1.23.0`) to update only when you decide |

Server variables you may set in `compose.yaml` (`environment:`) for special cases:

| Variable | |
|---|---|
| `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` / `DB_PASSWORD_FILE` | **before 1.25 only**: the old MariaDB/MySQL database, which the server only READS to migrate it ([sqlite-migration.md](sqlite-migration.md)). Remove them once the dashboard says "MariaDB is no longer needed" |
| `TENTACLE_PUBLIC_URL` | fallback public link (the one set in the administration wins) |
| `TRUSTED_PROXIES` | extra proxies whose `X-Forwarded-For` is trusted (comma-separated IPs/CIDRs) — see [remote-access.md](remote-access.md#trusted-proxies) |
| `REMOTE_CHECK_URL` | remote access test service and public address detection (`off` to disable both) |
| `TENTACLE_WEB_UI` | `off` turns the web interface off — see below |

## Database

Tentacle keeps everything (settings, accounts' data, statistics, extensions' data) in `data/tentacle.db`, a
SQLite file of its data volume (`tentacle-data` in the stacks, mounted on `/app/apps/backend/data`). There is
nothing to configure. The administration's *Services › Database* card shows its engine, file, size and state.

- **Back it up** by copying the file — see [operations.md](operations.md#back-up).
- **Keep the data folder on a local disk.** SQLite can get corrupted on a network share (NFS, SMB/CIFS…):
  Tentacle detects it and warns you in the log and on the *Database* card, without blocking.
- **Read it** from the container's console, read-only: `tentacle db query "SELECT key FROM server_config"`.

## Disable the web interface

Only use the apps (desktop, mobile, TV)? Set `TENTACLE_WEB_UI: "off"` in the `tentacle` service's `environment:`
(the line is already there, commented out), then restart the container. The web client (`/`, its pages and files)
then answers 404. What keeps working: the API and its sockets (`/api/…`, so every app), the LG TV client under
`/tv` (an app of its own, served by this server), `/.well-known/` (the remote access test) — and **the setup
wizard, as long as setup is not finished**: set before the end, the option closes the web only afterwards.

Back on: set it to `"on"` and restart, or type `tentacle web on` in the container's console (Portainer:
**Console** → *Connect*; or `docker exec <container> tentacle web on`) — it takes effect within five seconds,
without a restart. The command wins over the variable; `tentacle web default` follows the variable again,
`tentacle web status` tells the state and where it comes from. There is no switch in the administration: it *is*
the web interface, turning it off from there would lock you out.

## Podman

The stacks work with `podman compose` (or `podman-compose`). The media volume carries `:z` for SELinux.
Rootless: add `userns_mode: keep-id` to the `jellyfin` and `tentacle` services so files keep your ownership.
Hardware transcoding with Podman: see [gpu.md](gpu.md#podman).

## Without Docker

Tentacle also runs natively (`node apps/backend/dist/index.js` from a build). With no Jellyfin on the
machine, the wizard shows Jellyfin's official install command (Debian/Ubuntu) or its official guide, then
waits for Jellyfin to answer on `http://127.0.0.1:8096`. The Docker stacks remain the supported path.
