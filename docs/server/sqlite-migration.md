# Migrating to SQLite (server 1.25)

*Version française : [fr/sqlite-migration.md](fr/sqlite-migration.md).*

Since 1.25, Tentacle keeps all its data in **one file**, `data/tentacle.db` (SQLite), in its data volume. No
database server any more: one container less, 100 to 200 MB of memory saved, and a backup is a file copy.
Installations that used **MariaDB** (or MySQL) are migrated **by themselves**.

## What you do: nothing

Update the image as usual (`docker compose pull && docker compose up -d`, Portainer's *Pull and redeploy*,
your NAS's update button). **Keep your compose file as it is** — its `db` service, its `DB_*` or
`DATABASE_URL` variables, or the database chosen in the old wizard (`data/database.json`): that is how
Tentacle finds your data. Remove them only once the dashboard says so (see below).

## What happens

1. On its first start, Tentacle sees a configured MariaDB and no `tentacle.db`: it migrates. **MariaDB is
   only read** — in a read-only transaction, on a consistent snapshot. It is never modified, not even if the
   migration fails.
2. Meanwhile, the web, the desktop and mobile apps, the TVs show **"Database migration in progress"**, with
   the progress and the estimated time left. It usually takes a few seconds: about 3 on a real database,
   8 to 9 on a simulated slow NAS (table below).
   Apps that are not up to date just see the server restarting for those seconds.
3. Before switching, everything is **checked**: rows per table, a checksum per column, and a sample read
   the way the server will read it. Only then is the new database put in place.
4. Tentacle starts on SQLite. Its TMDB title cache follows **in the background**, copied from MariaDB (no
   call to TMDB); the *Services › Database* card shows its progress. Recommendations wait for it.
5. The dashboard then says **"MariaDB is no longer needed"**, with the steps for your installation.

| Measured on a real database (50 tables, 114,000 rows, 850 MB, 92 % of it a cache) | Fast machine | Slow NAS (simulated: ½ core, disk at 30 MB/s and 400 IOPS) |
|---|---|---|
| Interruption seen by the apps (everything but the TMDB cache, checks included) | ~3 s | 8-9 s |
| TMDB cache, in the background, server already running | ~25 s | ~1 min |

## Removing MariaDB

⚠️ **Only once the dashboard says "MariaDB is no longer needed".** Before that, your data may still be only
in MariaDB.

The dashboard shows the steps for the installation it detects (it never talks to Docker), the others next
to it:

- **Official stack from before 1.25** (`tentacle-full` or `tentacle-db`, with their `db` service), two ways:
  - the simplest: in the same folder, replace `compose.yaml` with today's
    [`tentacle-full`](../../stacks/tentacle-full/compose.yaml) (it replaces `tentacle-full`) or
    [`tentacle-only`](../../stacks/tentacle-only/compose.yaml) (it replaces `tentacle-db`); carry over your own
    changes (ports, GPU…), your `.env` stays valid;
  - or remove the lines yourself: the `db` and `init` services, `db` in the `depends_on` of `tentacle`,
    `DB_HOST` and `DB_PASSWORD_FILE`, the `tentacle-secrets` mount, and the `tentacle-db` and
    `tentacle-secrets` volumes at the bottom.

  Then `docker compose up -d --remove-orphans`: the `db` and `init` containers are stopped and removed; the
  data stays in its volume. Later, **only once you are sure**, `docker volume rm <project>_tentacle-db
  <project>_tentacle-secrets` deletes it for good (`docker volume ls` gives the names; `<project>` is usually
  the folder's name). A forgotten `depends_on` makes Compose refuse to start, with
  `service "tentacle" depends on undefined service "db": invalid compose project`: remove it.
- **Docker Compose**: remove the `db` service, its `depends_on` entry and, in the Tentacle service, the `DB_*` /
  `DATABASE_URL` variables, then `docker compose up -d --remove-orphans`.
- **Portainer**: *Stacks* → your stack → *Editor*: paste the new stack, or remove the `db` service and the
  variables; *Update the stack* with **Prune services** ticked (without it, the database container keeps
  running). A stack linked to the repository: set its reference back to `refs/heads/main`, *Pull and
  redeploy*. Later: *Volumes* → the database volume → *Remove*.
- **Synology** (Container Manager), **Unraid**, **CasaOS**: the same, in their interface.
- **Database chosen in the old wizard** (`tentacle-only` before 1.25, and other installations without `DB_*`
  variables): it is named by a file of the data folder; the dashboard gives the command that deletes it, to run
  in the container's console, then restart Tentacle.
- **External database** (a MariaDB on another machine, a NAS): remove the variables (or that file), restart
  Tentacle; then, whenever you wish, delete the Tentacle database from that server with the `DROP DATABASE`
  command the dashboard gives — Tentacle never runs anything on the old database.

## If the migration does not complete

The screen says **"The migration did not complete. Your data is intact."**, with the reason in plain words
— never a technical detail to an anonymous visitor. The old database is not modified; nothing is switched.

- Tentacle **retries by itself** (after 30 s, 1, 2, 5, 10, then every 15 minutes) and at each restart.
- **Retry at once**, with a readable report: `tentacle db migrate` in the container's console (Portainer:
  *Console*; or `docker exec <container> tentacle db migrate`).
- The log's **`[db-migration]`** lines say exactly what (table names and counts, never your data).

| Reason on the screen | What to do |
|---|---|
| The old database does not answer | Is MariaDB running, reachable from Tentacle, with the same password? |
| A connection setting is not understood | An unknown `DATABASE_URL` parameter: the log names it. TLS asked (`sslaccept`, `sslcert`…) is always required, never dropped. |
| Too old to move straight to this version | A server older than 1.4.0: install 1.24, start it once, then 1.25. |
| Not enough space | Free space in the data folder (about the size of the old database + 10 %). |

## Going back

The previous image (for example `ghcr.io/knaox/tentacle-tv:v1.24.0`) **always starts again on your
MariaDB**, intact. If you then update to 1.25 again after the old image has written in MariaDB, Tentacle
**detects it** and says so in *To fix*: *"The old MariaDB database changed since the migration"*. Nothing
is done automatically. The *Database* card offers **Migrate again**: the server restarts and migrates from
MariaDB; the current SQLite database is kept as a backup (`tentacle.db.<date>.bak`), and everything written
since the first migration is replaced by MariaDB's state.

## MariaDB removed too early

A stack updated to the new compose before the migration (no `db` service, no `DB_*` variables) cannot be
migrated: rather than starting on an empty database, Tentacle stays on the waiting screen and says
*"This installation used a MariaDB database that is no longer configured"*. It recognizes such an
installation by what it left in its data folder, even one that never ran 1.24. Put the database service and
its variables back, restart, let the migration run, then remove them.

- **Portainer stack deployed from this repository** (*Repository*): it receives the new `tentacle-full` as soon
  as it is published, before having migrated. Set its reference to the tag **`refs/tags/server-v1.24.0`** and
  redeploy: the old stack comes back, its MariaDB with it, and the current image migrates. Once the dashboard
  says "MariaDB is no longer needed", set the reference back to `refs/heads/main` and redeploy.
- **By hand**: the old files are kept under that tag —
  [`tentacle-full`](https://github.com/Knaox/Tentacle-TV/blob/server-v1.24.0/stacks/tentacle-full/compose.yaml),
  [`tentacle-db`](https://github.com/Knaox/Tentacle-TV/blob/server-v1.24.0/stacks/tentacle-db/compose.yaml).
  Put yours back in the same folder for the migration, then come back to the new one.

That database is lost for good, or you really want to start from scratch? In the container's console:
`tentacle db start-fresh --confirm`, then restart. A new installation starts (the setup wizard opens); the
old database is not touched.

## Good to know

- **Your own MariaDB or MySQL** (tentacle-only, NAS): the same URL as before is read the same way (port,
  encoded characters, password file, TLS parameters). An account with only the `SELECT` right is enough.
- **A database shared with other applications**: their tables are copied too, as a precaution, and listed
  in the report as "unrecognized tables, copied as a precaution". Nothing is lost.
- **Extensions** (Vigie…): their tables are copied whole. An extension that doesn't support SQLite yet stays
  stopped, with a clear message, until it is updated.
- **Time zones**: dates written by MariaDB in its own time zone are converted to UTC.
- **Network shares**: keep the data folder on a local disk; SQLite can get corrupted on NFS or SMB.
- **A database on ANOTHER machine, without TLS**: during the copy, its data crosses the network in clear.
  Add `sslaccept=strict` to its address (with `sslcert` if needed), or run Tentacle on the same machine as
  the database for the migration. With TLS asked, the connection is always encrypted, never in clear instead.

## Checking that your data is on SQLite

- *Administration › Services › Database*: engine **SQLite**, file `data/tentacle.db`, *"Migrated from
  MariaDB on …"* with the number of tables and rows.
- In the container's console: `tentacle db migrate` prints the migration report, and
  `tentacle db query "SELECT COUNT(*) AS n FROM paired_devices"` reads the database (read-only).
- Your accounts, devices, ratings, watch history and settings are there; your TVs and apps stay signed in.
