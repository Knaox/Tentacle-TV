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

## Logs

```bash
docker compose logs -f tentacle
```

Tokens, passwords and API keys are masked in the logs.

## Reopen the setup wizard

Setup done, the wizard is closed for good. Only the machine can reopen it:

```bash
docker compose exec tentacle tentacle setup reset
docker compose restart tentacle
docker compose logs tentacle        # the new setup code
```

Your settings, Jellyfin link and libraries stay; the wizard resumes at the libraries and asks for the
administrator account at the end.

A new setup code while setup is still open: `docker compose exec tentacle tentacle setup token`.

## Jellyfin API key

Tentacle creates its own key ("Tentacle") during setup. To replace it: **Jellyfin › Dashboard › API Keys**,
create a key, then paste it in **Administration › Services › Jellyfin**. Tentacle never shows the key back.

## Back up

The volumes hold everything:

| Volume | Content |
|---|---|
| `tentacle-db` | Tentacle's database (settings, accounts' data, statistics) |
| `tentacle-data` | Tentacle's data folder (plugins, caches) |
| `tentacle-secrets` | the generated database passwords |
| `jellyfin-config` | *full*: Jellyfin's configuration |

A database dump:

```bash
docker compose exec db sh -c 'mariadb-dump -u tentacle -p"$(cat /run/tentacle-secrets/db_password)" tentacle' > tentacle.sql
```

## Migrating from the old `docker-compose.yml`

The repository's old `docker-compose.yml` (and `docker-compose.external.yml`) **keep working** with the new
image: `DATABASE_URL` is still read, and the image fixes the ownership of an old data volume on start (it runs
as `PUID:PGID` from then on). Nothing forces you to move.

To move to a new stack anyway (generated secrets, healthchecks, optional Jellyfin and HTTPS proxy):

1. Dump the old database:
   `docker compose exec db mariadb-dump -u root -p"$MYSQL_ROOT_PASSWORD" tentacle_db > tentacle.sql`
2. Stop the old stack (`docker compose down`, **without** `-v`), and keep its folder.
3. In a new folder, start **tentacle-db** (or *tentacle-full*) once: `docker compose up -d`.
4. Import the dump:
   `docker compose exec -T db sh -c 'mariadb -u tentacle -p"$(cat /run/tentacle-secrets/db_password)" tentacle' < tentacle.sql`
5. Copy the old data volume's content (`tentacle-data`) into the new one, then `docker compose restart tentacle`.

The server sees an installed database and keeps its setup closed.
