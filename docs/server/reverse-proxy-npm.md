# Reverse proxy: Nginx Proxy Manager in detail

*Shorter, proxy-agnostic guide: [remote-access.md](remote-access.md). The administration (**Remote access**) also writes the block to paste for Caddy, Nginx / NPM and Traefik.*

If you expose Tentacle TV through **Nginx Proxy Manager**, follow these steps to enable real-time features (WebSocket).

## 1. Create a Proxy Host

| Field | Value |
|-------|-------|
| **Domain Names** | `tentacle.example.com` |
| **Scheme** | `http` |
| **Forward Hostname / IP** | Your server IP (e.g. `192.168.1.100`) |
| **Forward Port** | `3000` (or your configured `PORT`) |
| **Websockets Support** | **Enable** (toggle ON) |

> The **Websockets Support** toggle is required for the real-time home page updates and notification sync. Without it, WebSocket connections to `/api/ws` will fail and the app will fall back to 60-second polling.

## 2. SSL (recommended)

Go to the **SSL** tab and either:
- Select **Request a new SSL Certificate** with Let's Encrypt
- Or upload your own certificate

Enable **Force SSL** and **HTTP/2 Support**.

## 3. Advanced (strongly recommended)

Click the **gear icon** on the proxy host to open the Advanced tab and paste:

```nginx
proxy_hide_header Content-Security-Policy;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

- `proxy_hide_header Content-Security-Policy` removes any upstream CSP header that can block the app's WebSocket (`wss://`). The application ships its own CSP policy.
- `proxy_read_timeout 86400s` and `proxy_send_timeout 86400s` keep long-lived WebSocket connections (real-time home updates, notifications) alive for up to 24 h instead of being dropped by NPM's default 60 s idle timeout. Without these, the WS reconnects every minute and the home feed flickers.

## 4. Direct Streaming via same-domain Jellyfin (recommended)

If you enable **Direct Streaming** in the admin panel, the browser will issue XHR requests directly to your Jellyfin server. The **cleanest, CORS-free way** to expose Jellyfin to the browser is to serve it under a **sub-path of the same domain as Tentacle TV** (e.g. `tentacle.example.com/jellyfin`). Same origin → no preflight, no `Access-Control-Allow-Origin` headers to maintain, no Cloudflare worker.

### Step 1 — Tell Jellyfin to live under `/jellyfin`

In **Jellyfin → Dashboard → Networking → Base URL**, set:

```
/jellyfin
```

Save and **restart Jellyfin** (`docker restart jellyfin` or the equivalent). Without a restart Jellyfin keeps using the old base URL.

### Step 2 — Trust the reverse proxy

In **Jellyfin → Dashboard → Networking → Known Proxies**, add the IP of your NPM container (e.g. `172.16.1.30`). Otherwise Jellyfin discards `X-Forwarded-For` / `X-Forwarded-Proto` and may reject HLS requests with `401`.

In **Jellyfin → Dashboard → Networking → Published Server URIs**, add:

```
all=https://tentacle.example.com
```

This is the URL Jellyfin advertises to clients (including Tentacle TV mobile/desktop) — it must match what the browser sees.

### Step 3 — Add a Custom Location in NPM

On the existing **Tentacle proxy host** (`tentacle.example.com`), open the **Custom locations** tab and **Add location**:

| Field | Value |
|-------|-------|
| **Location** | `/jellyfin` |
| **Scheme** | `http` |
| **Forward Hostname / IP** | your Jellyfin container IP (e.g. `172.16.1.30`) |
| **Forward Port** | `8096` |

Click the **gear icon next to the location** (not the one at the top of the modal) → toggle **Enable Websockets Support** ON. Jellyfin's SyncPlay and live updates need it.

### Step 4 — Cloudflare DNS only (if you use Cloudflare)

In your Cloudflare DNS panel, set the record for `tentacle.example.com` to **DNS only** (grey cloud, not orange). Cloudflare's proxy combined with Jellyfin sub-paths consistently breaks HTTP/2 and WebSocket upgrades. Keep it grey for streaming.

### Step 5 — Configure Tentacle's Direct Streaming admin

In **Tentacle admin → Direct Streaming**, set both URLs to the new same-domain URL:

```
Public URL  : https://tentacle.example.com/jellyfin
Private URL : https://tentacle.example.com/jellyfin
```

(Or your LAN URL on the private side if your LAN clients should hit Jellyfin directly.)

### Verify

```bash
curl -sI "https://tentacle.example.com/jellyfin/web/main.jellyfin.bundle.js" \
  | grep -iE "content-type|server"
```

You must see `content-type: application/javascript`. If you see `text/html`, the Custom Location didn't take effect (the request is hitting Tentacle's SPA shell) — double-check the location path and reload NPM.

### Recovery if you mistyped Jellyfin's BaseURL

If you set the wrong BaseURL in Jellyfin and locked yourself out of the dashboard, edit `network.xml` in place:

```bash
# Reset BaseURL to empty (root)
docker exec jellyfin sed -i 's|<BaseUrl>.*</BaseUrl>|<BaseUrl />|' /config/network.xml
docker restart jellyfin

# Or set it explicitly to /jellyfin
docker exec jellyfin sed -i 's|<BaseUrl>.*</BaseUrl>|<BaseUrl>/jellyfin</BaseUrl>|' /config/network.xml
docker restart jellyfin
```

> **Note for users with other Jellyfin clients** (official mobile app, Findroid, Streamyfin, Sonarr/Radarr integrations): they'll need their server URL updated to include the new `/jellyfin` sub-path. If that's not acceptable, keep your existing `jellyfin.example.com` subdomain as a mirror proxy host in NPM and follow section 5 below to handle CORS instead.

## 5. Direct Streaming with a separate Jellyfin subdomain (CORS) — alternative

If you must keep Jellyfin on its own subdomain (e.g. `jellyfin.example.com`) for legacy clients, the browser will issue cross-origin requests for `PlaybackInfo` and the HLS `master.m3u8`. You will see errors like:

```
Origin https://tentacle.example.com is not allowed by Access-Control-Allow-Origin.
```

Jellyfin does not let you configure CORS in its UI, so the headers must be added by the reverse proxy in front of Jellyfin. In NPM, open the **Jellyfin** proxy host → gear icon → **Advanced** tab and paste:

```nginx
proxy_hide_header Content-Security-Policy;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;

# Strip any CORS headers Jellyfin sets itself, to avoid duplicates
proxy_hide_header Access-Control-Allow-Origin;
proxy_hide_header Access-Control-Allow-Credentials;
proxy_hide_header Access-Control-Allow-Methods;
proxy_hide_header Access-Control-Allow-Headers;
proxy_hide_header Access-Control-Expose-Headers;

# Add CORS headers for the Tentacle TV web client (replace with your origin)
add_header Access-Control-Allow-Origin      "https://tentacle.example.com" always;
add_header Access-Control-Allow-Credentials "true" always;
add_header Access-Control-Allow-Methods     "GET, POST, OPTIONS, DELETE, PUT, PATCH" always;
add_header Access-Control-Allow-Headers     "Authorization, X-Emby-Token, X-Emby-Authorization, X-Requested-With, Content-Type, Range, If-Modified-Since, Cache-Control" always;
add_header Access-Control-Expose-Headers    "Content-Length, Content-Range, Date, Server" always;
add_header Access-Control-Max-Age           "1728000" always;
```

**Important rules**

- Replace `https://tentacle.example.com` with the **exact** origin of your Tentacle TV client (scheme + host, no trailing slash).
- Every `add_header` value **must stay on a single line** inside its quotes — nginx does not allow line breaks in quoted strings. A broken value will fail `nginx -t` and NPM will refuse to reload, taking **all** your hosts offline (and Cloudflare will show error **525 SSL handshake failed**).
- Do not use a `map` directive in this tab. `map` only works at the `http {}` level, but NPM injects this block inside `server {}` and nginx will reject the config.
- Do not wrap the preflight in `if ($request_method = OPTIONS)`. Jellyfin already responds `204` to the preflight; the `always` flag on `add_header` is enough to attach the CORS headers to that 204.
- Specifying `Access-Control-Allow-Origin: *` is **not enough** here because Tentacle TV sends an `Authorization` header — the browser requires an explicit origin in that case.

**Verify**

From any machine, just after saving:

```bash
curl -sI https://jellyfin.example.com/System/Info/Public \
  -H "Origin: https://tentacle.example.com"
```

You should see **exactly one** `access-control-allow-origin: https://tentacle.example.com` line. If you also see a `*`, your `proxy_hide_header` did not take effect — check the host order and reload NPM (`docker restart nginx-proxy-manager`).

**Don't forget Jellyfin's Known Proxies**

In **Jellyfin → Dashboard → Networking → Known Proxies**, add the IP (or subnet) of your NPM container. Without this, Jellyfin discards `X-Forwarded-*` headers and may reject HLS requests with `401`, which masquerades as a CORS error in the browser.

**Automatic fallback (always on)**

If your CORS config is broken or partially missing, the web client detects the failure (CORS-blocked `PlaybackInfo` or HLS `manifestLoadError`) and **transparently falls back** to the same-origin backend proxy `/api/jellyfin/*` for that browser session. Playback still works. You'll see in DevTools console:

```
[Tentacle:PlaybackInfo] direct call failed, falling back to proxy: TypeError: Load failed
[Tentacle:Playback] { mode: "Transcode", transport: "proxy", directStreamingConfigured: true, … }
```

The `directStreamingConfigured: true` confirms the admin toggle stays ON; `transport: "proxy"` confirms the per-session fallback engaged. Native apps (desktop, mobile, TV) are unaffected — they have no CORS and continue full-direct.
