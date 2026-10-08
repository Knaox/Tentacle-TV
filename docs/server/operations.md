# Operations

*Version française : [fr/operations.md](fr/operations.md).*

## Update

```bash
docker compose pull
docker compose up -d
```

`TENTACLE_VERSION=latest` (default) follows every release; pin a version in `.env` to update only when you
decide. The administration's overview shows the running version, the latest published one, and the command
to copy — Tentacle never drives Docker itself.

**Updating to 1.25 from an earlier version** moves the database from MariaDB to SQLite, by itself: a waiting
screen shows meanwhile, then the dashboard tells you how to remove MariaDB — [sqlite-migration.md](sqlite-migration.md).

## Logs

```bash
docker compose logs -f tentacle     # Compose, from the stack's folder
docker logs -f <container>          # any Docker/Podman container, by name or ID
```

In Portainer: *Containers* → the Tentacle container → **Logs**; on a NAS, the container's log page. Tokens, passwords and API keys are masked in the logs.

## Reopen the setup wizard

Setup done, the wizard is closed for good. Only the machine can reopen it: type `tentacle setup reset` in
the container's console (Portainer: **Console** → *Connect*), restart the container, and read the new setup
code in its log. From a terminal:

```bash
docker exec <container> tentacle setup reset
docker restart <container>
docker logs <container>             # the new setup code
```

Your settings, Jellyfin link and libraries stay; the wizard resumes at the libraries and asks for the
administrator account at the end.

A new setup code while setup is still open: `tentacle setup token` in the container's console (`docker exec <container> tentacle setup token`).

## Jellyfin API key

Tentacle creates its own key ("Tentacle") during setup. To replace it: **Jellyfin › Dashboard › API Keys**,
create a key, then paste it in **Administration › Services › Jellyfin**. Tentacle never shows the key back.

## Back up

The volumes hold everything:

| Volume | Content |
|---|---|
| `tentacle-data` | Tentacle's data folder: **its database `tentacle.db`** (settings, accounts' data, statistics, extensions' data), plugins, caches |
| `jellyfin-config` | *full*: Jellyfin's configuration |
| `tentacle-db`, `tentacle-secrets` | before 1.25: the old MariaDB database and its passwords. Keep them until the dashboard says "MariaDB is no longer needed" ([sqlite-migration.md](sqlite-migration.md)) |

The database is one file. For a consistent copy, stop Tentacle for a moment (SQLite is written in WAL mode:
copy `tentacle.db` and, if present, `tentacle.db-wal` together):

```bash
docker compose stop tentacle
docker compose cp tentacle:/app/apps/backend/data/tentacle.db ./tentacle-backup.db
docker compose start tentacle
```

To restore: stop Tentacle, put the file back as `data/tentacle.db` (and remove `tentacle.db-wal` / `-shm`),
start it. The file holds the server's secrets (JWT secret, Jellyfin and TMDB keys): keep the copy private.

## Moving from an older compose file

Since 1.25 the repository ships **two** stacks, `tentacle-full` and `tentacle-only`, without a database.
`stacks/tentacle-db`, the root `docker-compose.yml` and `docker-compose.external.yml` are gone. **Your copy
keeps working** with the new image: its MariaDB (or the database chosen in the old wizard) is migrated to
SQLite by itself on the first start of 1.25 ([sqlite-migration.md](sqlite-migration.md)), and the image fixes
the ownership of an old data volume on start (it runs as `PUID:PGID` from then on).

To move to a current stack, **after** the dashboard says "MariaDB is no longer needed":

1. In the **same folder**, put `tentacle-full` (with Jellyfin) or `tentacle-only` (Tentacle alone) in place of
   your file (`curl -fsSLo compose.yaml …`, see [install.md](install.md)); delete an old `docker-compose.yml`
   left next to it. Carry over your own changes (ports, GPU, `TENTACLE_WEB_UI`…); your `.env` stays valid.
2. `docker compose up -d --remove-orphans`: the old `db`, `init` (or `web`) containers are removed. The data
   volume keeps its name (`<folder>_tentacle-data`): Tentacle restarts on its `tentacle.db`, setup closed.
3. Later, only once you are sure: `docker volume rm` the old database volume (`<folder>_tentacle-db`, or
   `<folder>_tentacle-db-data` for the old root `docker-compose.yml`) and `<folder>_tentacle-secrets`.

The dashboard's *MariaDB is no longer needed* card gives these steps for the installation it detects.
