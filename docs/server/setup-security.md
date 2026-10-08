# Who can open the setup wizard

*Version française : [fr/setup-security.md](fr/setup-security.md).*

A new Tentacle server is unclaimed until someone finishes its wizard — and whoever finishes it becomes the
administrator of Tentacle **and** of Jellyfin. This page says who may open that wizard, and why.

## The rule

| Who | What they get |
|---|---|
| The **first** browser that reaches Tentacle **directly from your home network** | the wizard, **no code** |
| The same address again (closed tab, expired session) | the wizard again, no code |
| Any **other** address on your network, once the wizard has been claimed | the code |
| Anyone over the Internet, through a proxy that forwards a public address, or whose real address is unknown | the code |
| Anyone, once setup is finished | nothing: the wizard is closed for good (`tentacle setup reset` on the machine reopens it) |

The code is printed in the container's log and written to `data/setup-token.txt`: reading it proves you
have access to the machine.

## "Directly from your home network" means all of this

1. **A private address**: RFC 1918 (10/8, 172.16/12, 192.168/16), IPv6 ULA (fc00::/7), link-local,
   loopback. Not CGNAT (100.64/10): it is shared between an operator's customers, and Tailscale uses it.
2. **Seen without a proxy**, or forwarded by a **trusted neighbour proxy** (same machine, home network or
   Docker networks, plus `TRUSTED_PROXIES`). A `X-Forwarded-For` header from anyone else is ignored and the
   code is asked.
3. **Not through the container's gateway.** Docker Desktop, colima, and Docker's IPv6 relay make *every*
   connection — Internet included — look like it comes from the gateway, a private address. Tentacle can't
   tell who is behind it, so it asks for the code. Same with **rootless Podman** on a bridge network (the
   Compose stacks): its port forwarder, rootlessport, makes every connection come from the container's *own*
   address. A browser on the server machine itself may arrive that way too (pasta, host network): it gets the
   code as well — from inside the container, the two can't be told apart.
4. **The address typed in the browser is local too**: a private IP, a name without a dot, or `.local`,
   `.lan`, `.home`, `.home.arpa`, `.internal`… A public domain name means you're going through the Internet
   or a proxy — even a proxy that forgot to forward your address won't pass the Internet off as home.

## What stops an intruder

| Threat | Guard |
|---|---|
| Someone on the Internet finds the open wizard (port forwarded too early) | public address → code |
| They forge `X-Forwarded-For: 192.168.1.5` | only neighbour proxies are believed |
| They come through Docker Desktop's gateway | gateway = unknown address → code |
| They come through rootless Podman's port forwarder (and forge `Host` or `X-Forwarded-For`) | the container's own address = unknown → code |
| A misconfigured proxy forwards no address | the public domain name in the browser → code |
| A second device on your network tries to take over a setup in progress | the claimant's address is kept (in the data volume, survives a restart) → code |
| A setup session leaks (screenshot, log) | each session is bound to the address that opened it |
| A guest on your Wi-Fi gets there first | they would see it; you'd notice at once (you can't open the wizard without the code). Finish setup right after starting the server, or `tentacle setup reset` and start again |
| Someone guesses the code | 60 bits, 5 tries per minute per address, a new code after 10 wrong ones |
| The wizard used after setup | closed for good: every route answers 404 |
| A tampered browser (or a direct API call) skips a step: creates an account or a library on a Jellyfin that was already set up, skips choosing the Jellyfin | the **server** holds the path (`setupFlowContract.ts`): the chosen Jellyfin, probed by the server, decides it; any step outside it is refused (`step_refused`) |
| The wizard turned against your network (SSRF) | Jellyfin is only looked for at private addresses or the one your browser typed, while setup is open, with a session; link-local and cloud metadata are refused at connection time. One exception: `host.docker.internal` / `host.containers.internal` typed **by name** and leading to the link-local address the container engine wrote in `/etc/hosts` (rootless Podman: 169.254.1.2) — never an address typed as such, never 169.254.169.0/24 or 169.254.170.0/24 |

## The trade-off we accepted

Like Jellyfin and Plex, the home network is trusted for the first claim. Someone already on your network
in the minutes after the server starts could claim it before you. You would know at once: your own browser
would be asked for the code. Then `tentacle setup reset` in the container's console, restart it, and start
again. On a network you don't trust (shared flat, open Wi-Fi), the code is still there: open the wizard
through a public domain name or a reverse proxy, and it is always asked.
