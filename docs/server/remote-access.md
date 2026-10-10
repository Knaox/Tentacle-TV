# Remote access

*Version française : [fr/remote-access.md](fr/remote-access.md).*

Tentacle guides you in **Administration › Remote access** (and in the optional wizard step) — the same panel
and the same rules in both places.

## Private or public

- **Private** (the default): only the devices at home reach Tentacle, through its private address — *this
  server's address on your network*, for example `http://192.168.1.20:3000`, suggested from the address you
  opened the page with.
- **Public**: your family and friends reach it from their place, through your router's public address (shown,
  detected automatically).

**What is set is published**, as in 1.23.0: Tentacle's public link and Jellyfin's public address are given to
the apps as soon as they are set; without a public link, Tentacle only answers at home (TV pairing gets the
server's private address instead, so it keeps working). The page opens on the state, read-only — what the apps
receive at home and away —, then on the **addresses**, the only things to set: public link, direct play,
Jellyfin's address on the network and Jellyfin's public address. A server coming from an earlier version finds
them pre-filled, with nothing to redo. Everything else (reverse proxy, ports, test) is folded under **Learn
more**: nothing there is mandatory.

The router's public address is the one seen by the last port test, otherwise asked to Cloudflare's
`cdn-cgi/trace` page (IPv4, no account, at most every ten minutes); `REMOTE_CHECK_URL=off` turns both off.

**CORS**: Tentacle adds its own addresses (public link, local address, the admin's page, the desktop app) to
Jellyfin's CORS hosts — at startup, when Jellyfin comes back, on every save and before every test. An empty list
or one containing `*` is never touched: Jellyfin already accepts every origin there. Nothing to do on that side.

**Direct play**: the private address of Jellyfin is enough to turn it on (setup turns it on at home). Its
**public address is optional**: without it, away from home, playback goes through Tentacle — only Tentacle's
port needs opening.

## 1. Put an HTTPS reverse proxy in front (recommended)

**Optional.** Caddy, Traefik and Nginx are **neither included nor installed** by Tentacle: only pick one if you
already have it; otherwise keep "No proxy" (the default). A reverse proxy is a program that receives visits from
the Internet and passes them to Tentacle, adding HTTPS.

The Docker stacks **do not ship a reverse proxy**: you probably already have one (Nginx Proxy Manager, Caddy,
Traefik…), and Tentacle simply goes behind it. If you have none yet, Caddy is the simplest to install (a system
package or its own container): certificates are automatic.

| What faces the Internet | What to do |
|---|---|
| **Caddy** | add the Caddyfile block below |
| **Nginx / Nginx Proxy Manager** (or another proxy) | one proxy host per domain, websockets on — the Nginx block below as a template |
| **Traefik** | add the routes file below to its file provider (no Docker socket needed) |
| No proxy | Tentacle's port opened as is: **everything travels in clear text** — avoid it |

**Administration › Remote access** writes these blocks with your own domains and this server's address
(step 1). Each domain needs a DNS **A** record (and **AAAA** if you have IPv6) pointing to your public address;
the Jellyfin domain is only needed for direct play from the Internet. The examples below use
`tentacle.example.com`, `jellyfin.example.com` and a server at `192.168.1.20` with the default ports (3000,
8096): replace them with yours. A proxy running in the **same Docker network** as the stack can target the
services by name instead: `tentacle:3000` and `jellyfin:8096`.

On Jellyfin, the proxy sets **Tentacle's CORS headers in place of Jellyfin's own** (never both: a duplicated
`Access-Control-Allow-Origin` makes the browser refuse everything).

**Jellyfin under a path of Tentacle's domain** (`https://tentacle.example.com/jellyfin`): a single site, the path to
Jellyfin, the rest to Tentacle — and **no CORS header**, the same origin needs none. In Jellyfin › Dashboard ›
Networking, set the "Base URL" to the same path. The page writes this example too ("A path of Tentacle's domain"),
with Jellyfin's address on the network when it is not Tentacle's.

### Caddy

Caddy gets and renews the certificates on its own once ports 80 and 443 reach it.

```caddyfile
tentacle.example.com {
  reverse_proxy 192.168.1.20:3000
}
jellyfin.example.com {
  reverse_proxy 192.168.1.20:8096 {
    header_down Access-Control-Allow-Origin "https://tentacle.example.com"
    header_down Access-Control-Allow-Credentials "true"
    header_down Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT, PATCH"
    header_down Access-Control-Allow-Headers "Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control"
    header_down Access-Control-Expose-Headers "Content-Length, Content-Range, Date, Server"
  }
}
```

### Nginx / Nginx Proxy Manager

In **Nginx Proxy Manager**: one *Proxy Host* per domain, to `http://192.168.1.20:3000` (Tentacle) and
`http://192.168.1.20:8096` (Jellyfin), with *Websockets Support*, a Let's Encrypt certificate and *Force SSL*;
the Jellyfin CORS lines (`proxy_hide_header` / `add_header`) go in its *Advanced* tab. With plain **Nginx**, add
your `ssl_certificate` and `ssl_certificate_key` lines:

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name tentacle.example.com;
  client_max_body_size 0;
  location / {
    proxy_pass http://192.168.1.20:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
  }
}

server {
  listen 443 ssl;
  http2 on;
  server_name jellyfin.example.com;
  client_max_body_size 0;
  location / {
    proxy_pass http://192.168.1.20:8096;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Credentials;
    proxy_hide_header Access-Control-Allow-Methods;
    proxy_hide_header Access-Control-Allow-Headers;
    proxy_hide_header Access-Control-Expose-Headers;
    add_header Access-Control-Allow-Origin "https://tentacle.example.com" always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT, PATCH" always;
    add_header Access-Control-Allow-Headers "Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control" always;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Date, Server" always;
  }
}
```

### Traefik

A routes file for Traefik's **file provider**. `websecure` and `letsencrypt` are the usual names of the HTTPS
entry point and the ACME certificate resolver: replace them with yours.

```yaml
http:
  routers:
    tentacle:
      rule: Host(`tentacle.example.com`)
      entryPoints: [websecure]
      service: tentacle
      tls: { certResolver: letsencrypt }
    jellyfin:
      rule: Host(`jellyfin.example.com`)
      entryPoints: [websecure]
      service: jellyfin
      middlewares: [jellyfin-cors]
      tls: { certResolver: letsencrypt }
  middlewares:
    jellyfin-cors:
      headers:
        accessControlAllowOriginList: ["https://tentacle.example.com"]
        accessControlAllowCredentials: true
        accessControlAllowMethods: [GET, POST, OPTIONS, DELETE, PUT, PATCH]
        accessControlAllowHeaders: [Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control]
        accessControlExposeHeaders: [Content-Length, Content-Range, Date, Server]
        addVaryHeader: true
  services:
    tentacle:
      loadBalancer:
        servers: [{ url: "http://192.168.1.20:3000" }]
    jellyfin:
      loadBalancer:
        servers: [{ url: "http://192.168.1.20:8096" }]
```

Then tell Jellyfin about the proxy: add its address to **Known proxies** (Dashboard › Networking), otherwise
every connection seems to come from the proxy. For Tentacle, see [Trusted proxies](#trusted-proxies).

## 2. Open the router ports

| Behind a proxy | Without a proxy |
|---|---|
| **443** (HTTPS) and **80** (redirect to HTTPS, certificate renewals) → the proxy's machine | Tentacle's port (`TENTACLE_PORT`, 3000) → this machine; Jellyfin's (`JELLYFIN_PORT`, 8096) only for direct play away from home — the panel shows both with their real numbers |

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
Linux machine or a NAS. **Rootless Podman** on a bridge network (the Compose stacks) does the same through its
port forwarder, rootlessport: every visitor seems to come from the container's own address. The setup wizard
then always asks for its code; for the rest, put a reverse proxy in front (it sees the real address and
forwards it), or publish the ports with Podman's `pasta` network, which keeps the source address.

## Good practices

Long, unique passwords for every Jellyfin account (the administrator first) · keep Tentacle and Jellyfin up to
date · never administer over HTTP from the Internet · on the proxy, fail2ban or CrowdSec block repeated
password attempts.
