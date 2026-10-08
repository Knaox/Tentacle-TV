# Troubleshooting

*Version française : [fr/troubleshooting.md](fr/troubleshooting.md).*

| Symptom | Fix |
|---|---|
| "This code is wrong, or it was already used" | Codes are single-use. The Tentacle container's log (Portainer: *Logs*; `docker logs <container>`) shows the current one; `tentacle setup token` in its console (`docker exec <container> tentacle setup token`) gives a new one. |
| "Too many attempts" | Five codes per minute per address, and a new code after ten wrong ones (for everyone): wait a minute, read the new code in the logs. |
| The wizard says the setup is already done | It is closed for good. Reopen it from the machine: [operations.md](operations.md#reopen-the-setup-wizard). |
| "In Docker, localhost means Tentacle itself" | Give Jellyfin's real address: `http://host.docker.internal:8096` (Jellyfin on the same machine) or `http://192.168.x.y:8096`. |
| "Nobody answers at this address" | Is Jellyfin running? Right port? From a container, a firewall on the host may block it. |
| "This Jellyfin version is not supported" | Update Jellyfin (10.10 at least; 10.11 and 12 are tested). |
| "Database migration in progress" stays on screen | The 1.25 is copying the old MariaDB database: a few seconds (about ten on a slow NAS). The screen shows the progress and comes back by itself. Details: [sqlite-migration.md](sqlite-migration.md). |
| "The migration did not complete" | Your data is intact (MariaDB is only read). The screen says why; the log's `[db-migration]` lines say exactly what. Fix it, then retry at once with `tentacle db migrate` (or wait for the automatic retry). Going back to the previous image always works: [sqlite-migration.md](sqlite-migration.md#going-back). |
| "This installation used a MariaDB database that is no longer configured" | The stack lost its `db` service or `DB_*` variables before the migration: put them back for the migration, then restart. A Portainer stack deployed from the repository: point it at the tag `server-v1.24.0` meanwhile. [sqlite-migration.md](sqlite-migration.md#mariadb-removed-too-early) |
| "The database is on a network share" | SQLite can get corrupted on NFS/SMB: move the data folder (`tentacle-data`) to a local disk. |
| Libraries: "This folder does not exist for Jellyfin" | Paths are **Jellyfin's**: in a container, your media folder is `/media`. |
| Remote access test: "service unavailable" | The test service does not answer (or `REMOTE_CHECK_URL=off`): it says nothing about your setup. |
| Everything looks "local" behind Docker Desktop | Docker Desktop/colima hide visitors' addresses: see [remote-access.md](remote-access.md#trusted-proxies). |
| The video stays black / stutters in transcoding | See [gpu.md](gpu.md); check Jellyfin's transcoding settings. |

Logs first: the Tentacle container's (Portainer: *Logs*; `docker logs --tail 200 <container>`; Compose: `docker compose logs --tail 200 tentacle`), then Jellyfin's.
