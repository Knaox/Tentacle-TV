# Tentacle server — documentation

*Version française : [fr/README.md](fr/README.md).*

Tentacle is a server you host yourself, next to (or together with) Jellyfin. Three Docker Compose stacks
cover every case; a guided setup wizard does the rest in the browser.

| I want… | Read |
|---|---|
| to install Tentacle (and Jellyfin, if I don't have one yet) | [install.md](install.md) |
| to reach my server away from home, over HTTPS | [remote-access.md](remote-access.md) |
| hardware transcoding (Intel, AMD, NVIDIA) | [gpu.md](gpu.md) |
| to update, back up, reopen the wizard, or migrate from the old compose file | [operations.md](operations.md) |
| to fix something that doesn't work | [troubleshooting.md](troubleshooting.md) |
| to run the remote access test service (maintainers) | [port-check.md](port-check.md) |

## In one minute

```bash
mkdir tentacle && cd tentacle
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
docker compose up -d
docker compose logs tentacle     # the one-time setup code and the link (Portainer: the container's Logs)
```

Portainer, a NAS, another service name? The code is in **the Tentacle container's log**, wherever you read
it; the wizard's code screen shows this container's ID and the commands for each case.

Open `http://<this-machine>:3000`, enter the setup code, and answer the wizard's questions one at a time:
Jellyfin is configured for you, your libraries are created, and you are signed in.

## What the stacks guarantee

- **No secret to write.** Database passwords are generated on the first start (`init` service) and live in a
  volume only the database and Tentacle can read.
- **Never root, never the Docker socket.** Tentacle runs as `PUID:PGID` (1000:1000 by default) and does not
  mount `/var/run/docker.sock` — it never drives Docker.
- **A one-time setup code.** Until setup is done, nobody on your network can claim the server: the wizard asks
  for a code printed in the server's logs. Once setup is done, the wizard is closed for good (only
  `tentacle setup reset`, run on the machine, reopens it).
- **Podman works too** (rootless included): see [install.md](install.md#podman).
