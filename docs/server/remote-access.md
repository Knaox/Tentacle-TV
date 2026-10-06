# Remote access

*Version française : [fr/remote-access.md](fr/remote-access.md).*

Tentacle guides you in **Administration › Remote access** (and in the optional wizard step). Three steps:
what faces the Internet, the router ports, and a test run **from the outside**.

## 1. Put an HTTPS reverse proxy in front (recommended)

| Option | When |
|---|---|
| **Caddy** (`caddy` profile of *tentacle-full*) | the simplest: automatic certificates |
| **Traefik** (`traefik` profile, file provider — no Docker socket) | you prefer Traefik |
| **Your own proxy** (Nginx Proxy Manager, Caddy, Traefik…) | it already runs at home: the admin page generates the snippet |
| No proxy | Tentacle's port opened as is: **everything travels in clear text** — avoid it |

With the stacks:

```bash
# .env next to compose.yaml
TENTACLE_DOMAIN=tentacle.example.com
JELLYFIN_DOMAIN=jellyfin.example.com    # only for direct play from the Internet
```

```bash
docker compose --profile caddy up -d     # or: --profile traefik
```

Each domain needs a DNS **A** record (and **AAAA** if you have IPv6) pointing to your public address.
The configuration (CORS headers for Jellyfin included, never duplicated) is already in the compose file.

## 2. Open the router ports

| Behind a proxy | Without a proxy |
|---|---|
| **443** (HTTPS) and **80** (redirect to HTTPS, certificate renewals) → this machine | Tentacle's port (`TENTACLE_PORT`, 3000) → this machine; Jellyfin's (8096) only for direct play |

Give the server a **fixed address** in the router (DHCP reservation). The admin page links to the official
guides of Swisscom, Sunrise, Salt, Free, Orange and Bouygues (checked on 2026-10-06; SFR's site could not be
checked — look for "redirection de ports" in its help).

**IPv6**: nothing to forward (each device has its own address), but the router's firewall usually blocks
incoming traffic: allow the port for this server there.

## 3. Test from the outside

The **Run the test** button asks an external service (`check.tentacletv.app`, configurable with
`REMOTE_CHECK_URL`, `off` to disable) to reach your server the way a phone on 4G would — over IPv4, then IPv6.
The service **only tests the address the request comes from**: it never probes an address you give it, and
follows a domain only if it points to that same address. Tentacle proves it is the one answering with a
one-time challenge (`/.well-known/tentacle-check/<id>`, 60 seconds).

Results, per service: *reachable over HTTPS* (the goal), *exposed over HTTP* (red: passwords travel in clear
text), *needs a look* (certificate, proxy), *unreachable* — with the likely cause in plain words: port not
forwarded, wrong device, certificate, DNS, IPv6 firewall, or shared address (CGNAT).

## CGNAT: when nothing can open

Some providers share one IPv4 between several customers (CGNAT, DS-Lite): no port forwarding can help.
To find out, compare the **WAN address shown by your router** with the one the test sees (the admin page does
it): different, or between `100.64.x.x` and `100.127.x.x`, means sharing. Fixes: ask your provider for a public
IPv4 (Sunrise: switch to IPv4 on request; Salt: paid option; Free: "IPv4 fixe full-stack" in the Espace
Abonné), or **plan B**.

### Plan B: Tailscale (documented, not integrated)

Tailscale builds an encrypted private network between your devices, through any router (CGNAT included):
nothing to open, nothing exposed. Every device needs Tailscale and your account; those that cannot install it
have no access, and relayed connections are slower. Tentacle does not integrate it.
[Download](https://tailscale.com/download) · [Quickstart](https://tailscale.com/docs/how-to/quickstart) ·
[How NAT traversal works](https://tailscale.com/blog/how-nat-traversal-works) ·
[Jellyfin and Tailscale](https://jellyfin.org/docs/general/post-install/networking/tailscale/)

## Cloudflare: not for video

Cloudflare's proxy (orange cloud) and Cloudflare Tunnel are handy for a web page, but their terms limit video:
the **"Content Delivery Network (Free, Pro, or Business)"** section of the
[service-specific terms](https://www.cloudflare.com/service-specific-terms-application-services/#content-delivery-network-free-pro-or-business)
reserves serving video and large files to dedicated paid services, and the
[Cloudflare Tunnel FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/#large-file-and-streaming-traffic-through-tunnel)
applies the same rule to a tunnel's public hostnames. Keep Tentacle's and Jellyfin's domains on **DNS only**
(grey cloud) and use your own proxy. Behind Cloudflare's proxy, only accept Cloudflare's addresses at the
origin — otherwise `CF-Connecting-IP` can be forged by anyone reaching your server directly.

## Trusted proxies

Tentacle believes `X-Forwarded-For`, `X-Real-IP` and `CF-Connecting-IP` **only from its neighbours**: the
machine, the local network and Docker networks (127/8, 10/8, 172.16/12, 192.168/16, ::1, fc00::/7). A proxy
outside those ranges: add it with `TRUSTED_PROXIES` (comma-separated IPs or CIDRs). This keeps the login rate
limit and the "local network" detection (bitrate caps, private Jellyfin address) from being fooled.

**Docker Desktop (Windows, macOS) and colima** do not pass visitors' real addresses to containers: everything
seems to come from the Docker gateway, so every client looks "local". For access from the Internet, prefer a
Linux machine or a NAS.

## Good practices

Long, unique passwords for every Jellyfin account (the administrator first) · keep Tentacle and Jellyfin up to
date · never administer over HTTP from the Internet · on the proxy, fail2ban or CrowdSec block repeated
password attempts.
