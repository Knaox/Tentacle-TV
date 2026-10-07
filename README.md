<p align="center">
  <img src="brand/logo-color.svg" alt="Tentacle TV" width="128" />
</p>

<h1 align="center">Tentacle TV</h1>

<p align="center">
  <strong>A premium, modern media client for Jellyfin</strong>
</p>

<p align="center">
  <a href="https://discord.gg/FRse3yMhnc"><img src="https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white" alt="Discord" /></a>
  <a href="#quick-start-docker"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://github.com/Knaox/Tentacle-TV/releases"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FKnaox%2FTentacle-TV%2Fmain%2Fversions.json&query=%24.desktop&label=desktop&color=8b5cf6" alt="Desktop version" /></a>
  <a href="#quick-start-docker"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FKnaox%2FTentacle-TV%2Fmain%2Fversions.json&query=%24.server&label=server&color=d946ef" alt="Server version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  Browse and stream your Jellyfin library through a sleek, dark-themed interface with glassmorphism design, smooth animations, and powerful features — all self-hosted.
</p>

> [!IMPORTANT]
> **Tentacle TV is not affiliated with, endorsed by, or sponsored by the Jellyfin
> project.** It is an independent third-party client that connects to a Jellyfin server
> you run yourself. Official Jellyfin project: <https://jellyfin.org>.
>
> **Tentacle TV n'est ni affilié au projet Jellyfin, ni approuvé ou soutenu par lui.**
> C'est un client tiers indépendant qui se connecte à un serveur Jellyfin que vous
> hébergez vous-même.

<p align="center">
  <img src="docs/screenshot-home.png" alt="Tentacle TV on a computer, an Apple TV and a phone — Tentacle TV sur ordinateur, Apple TV et téléphone" width="800" />
  <br />
  <sub>Screenshots: open movies by the Blender Foundation, CC BY — <a href="docs/screenshots/CREDITS.md">credits</a> · Captures : films libres de la Blender Foundation, CC BY — <a href="docs/screenshots/CREDITS.md">crédits</a></sub>
</p>

---

## Quick Start (Docker)

**One file, one command: Tentacle, its MariaDB database and Jellyfin, ready together.** A setup wizard then
configures everything from your browser.

You only need Docker (or Podman). Pick one of three ready-to-copy stacks — **nothing to edit, no password to
write**: the database secrets are generated on the first start.

| Stack | Contains | For |
|---|---|---|
| [`stacks/tentacle-full`](stacks/tentacle-full/compose.yaml) (recommended) | Tentacle, MariaDB, **Jellyfin** | starting from scratch |
| [`stacks/tentacle-db`](stacks/tentacle-db/compose.yaml) | Tentacle, MariaDB | a Jellyfin that already runs elsewhere |
| [`stacks/tentacle-only`](stacks/tentacle-only/compose.yaml) | Tentacle | existing MariaDB/MySQL and Jellyfin |

```bash
mkdir tentacle && cd tentacle
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
docker compose up -d
docker compose logs tentacle     # the one-time setup code and the link (Portainer: the container's Logs)
```

Portainer, a NAS, another service name? The code is in **the Tentacle container's log**, wherever you read
it; the wizard's code screen shows this container's ID and the commands for each case.

Open `http://<your-server>:3000`, enter the setup code, and answer the wizard's questions one at a time:
Jellyfin is configured for you, your libraries are created, remote access is guided and tested from the
outside. No stack ships a reverse proxy: for HTTPS from the Internet, Tentacle goes behind **yours** (Nginx
Proxy Manager, Caddy, Traefik…), and the admin page writes what to put in it.

**Step-by-step guide, with screenshots, in English and French: <https://tentacletv.app/docs/server/>** —
every screen of the wizard, adding content, remote access (port forwarding, your reverse proxy, CGNAT),
troubleshooting and FAQ. Reference pages for maintainers: [docs/server](docs/server/README.md)
([français](docs/server/fr/README.md)).

> The previous [`docker-compose.yml`](docker-compose.yml) and [`docker-compose.external.yml`](docker-compose.external.yml)
> keep working with the new image; moving to a stack is optional
> ([migration](docs/server/operations.md#migrating-from-the-old-docker-composeyml)).

### Update

The admin overview (`/admin`) shows the running version, the latest published release and, when a newer one is out, the command to copy. With Docker Compose, run it in the folder of your `compose.yaml`:

```bash
docker compose pull && docker compose up -d
```

If you pin a version (`TENTACLE_VERSION=v1.23.0`, or `ghcr.io/knaox/tentacle-tv:v1.23.0`), change it to the new one first — `pull` would fetch nothing new otherwise. Tentacle never talks to Docker itself; the overview notices the restarted server on its own.

---

## Platforms

| Platform | Status | Download | Technology |
|----------|--------|----------|------------|
| **Web** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | Self-hosted | React 19 + Vite 6 + Tailwind CSS |
| **macOS** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | Electron + native mpv player |
| **Windows** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://apps.microsoft.com/detail/9NKHL0T84245"><img src="https://img.shields.io/badge/Microsoft_Store-0078D4?style=flat-square&logo=microsoftstore&logoColor=white" alt="Microsoft Store" /></a> | Electron + native mpv player |
| **Linux** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://github.com/Knaox/Tentacle-TV/releases"><img src="https://img.shields.io/badge/deb%20%C2%B7%20rpm%20%C2%B7%20pacman%20%C2%B7%20AppImage-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" /></a> | Electron + native mpv player (HDR on Wayland) |
| **iOS** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | React Native + Expo |
| **Android** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://play.google.com/store/apps/details?id=com.tentacletv.mobile"><img src="https://img.shields.io/badge/Google_Play-414141?style=flat-square&logo=googleplay&logoColor=white" alt="Google Play" /></a> | React Native + Expo |
| **Android TV** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://play.google.com/store/apps/details?id=com.tentacletv.mobile"><img src="https://img.shields.io/badge/Google_Play-414141?style=flat-square&logo=googleplay&logoColor=white" alt="Google Play" /></a> | React Native + ExoPlayer/Media3 |
| **Apple TV** | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | React Native (tvOS) |

<details>
<summary>🇫🇷 Plateformes (français)</summary>

| Plateforme | Statut | Téléchargement | Technologie |
|------------|--------|----------------|-------------|
| **Web** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | Auto-hébergé | React 19 + Vite 6 + Tailwind CSS |
| **macOS** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | Electron + lecteur mpv natif |
| **Windows** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://apps.microsoft.com/detail/9NKHL0T84245"><img src="https://img.shields.io/badge/Microsoft_Store-0078D4?style=flat-square&logo=microsoftstore&logoColor=white" alt="Microsoft Store" /></a> | Electron + lecteur mpv natif |
| **Linux** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://github.com/Knaox/Tentacle-TV/releases"><img src="https://img.shields.io/badge/deb%20%C2%B7%20rpm%20%C2%B7%20pacman%20%C2%B7%20AppImage-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" /></a> | Electron + lecteur mpv natif (HDR sous Wayland) |
| **iOS** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | React Native + Expo |
| **Android** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://play.google.com/store/apps/details?id=com.tentacletv.mobile"><img src="https://img.shields.io/badge/Google_Play-414141?style=flat-square&logo=googleplay&logoColor=white" alt="Google Play" /></a> | React Native + Expo |
| **Android TV** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://play.google.com/store/apps/details?id=com.tentacletv.mobile"><img src="https://img.shields.io/badge/Google_Play-414141?style=flat-square&logo=googleplay&logoColor=white" alt="Google Play" /></a> | React Native + ExoPlayer/Media3 |
| **Apple TV** | ![Disponible](https://img.shields.io/badge/Disponible-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | React Native (tvOS) |

</details>

---

## Features

### Video Playback
- HTML5 player (web) with HLS streaming via hls.js
- Native mpv player (desktop) with Direct Play, Dolby Vision, and Atmos support
- Android TV: ExoPlayer/Media3 with hardware decoding, HDR/DV passthrough, and surround audio bitstream
- On-the-fly audio track and subtitle switching
- Resume watching — pick up right where you left off
- Per-library preferences (default audio language, subtitles)

### Interface
- Premium dark theme with purple/pink glassmorphism accents
- Dynamic hero banner with auto-rotation
- Expandable sidebar with library hover previews
- Animated media cards with smooth CSS transitions
- Global search with keyboard shortcut (`Ctrl+K`)
- Fully responsive — works on any screen size
- Multi-language (English & French)

### Plugin System
- Extensible architecture with a built-in admin marketplace
- Multiple registry sources (custom GitHub-hosted registries)
- One-click install, update, and uninstall
- Plugins auto-integrate into navigation and routing
- SHA256 verification and version compatibility checks

### Administration
- Guided setup wizard (database, Jellyfin connection, admin account)
- Invite system to control user access
- Built-in support tickets
- TV pairing via 4-digit code
- Real-time notifications

---

## Reverse Proxy (Nginx Proxy Manager)

> The stacks ship no reverse proxy: Tentacle goes behind yours. **Administration › Remote access** writes what
> to put in it — a Caddyfile block, an Nginx / Nginx Proxy Manager block or a Traefik routes file — then guides
> the router ports and tests from the outside; see [docs/server/remote-access.md](docs/server/remote-access.md).
> This section details Nginx Proxy Manager, including same-domain direct streaming.

If you expose Tentacle TV through **Nginx Proxy Manager**, follow these steps to enable real-time features (WebSocket).

### 1. Create a Proxy Host

| Field | Value |
|-------|-------|
| **Domain Names** | `tentacle.example.com` |
| **Scheme** | `http` |
| **Forward Hostname / IP** | Your server IP (e.g. `192.168.1.100`) |
| **Forward Port** | `3000` (or your configured `PORT`) |
| **Websockets Support** | **Enable** (toggle ON) |

> The **Websockets Support** toggle is required for the real-time home page updates and notification sync. Without it, WebSocket connections to `/api/ws` will fail and the app will fall back to 60-second polling.

### 2. SSL (recommended)

Go to the **SSL** tab and either:
- Select **Request a new SSL Certificate** with Let's Encrypt
- Or upload your own certificate

Enable **Force SSL** and **HTTP/2 Support**.

### 3. Advanced (strongly recommended)

Click the **gear icon** on the proxy host to open the Advanced tab and paste:

```nginx
proxy_hide_header Content-Security-Policy;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

- `proxy_hide_header Content-Security-Policy` removes any upstream CSP header that can block the app's WebSocket (`wss://`). The application ships its own CSP policy.
- `proxy_read_timeout 86400s` and `proxy_send_timeout 86400s` keep long-lived WebSocket connections (real-time home updates, notifications) alive for up to 24 h instead of being dropped by NPM's default 60 s idle timeout. Without these, the WS reconnects every minute and the home feed flickers.

### 4. Direct Streaming via same-domain Jellyfin (recommended)

If you enable **Direct Streaming** in the admin panel, the browser will issue XHR requests directly to your Jellyfin server. The **cleanest, CORS-free way** to expose Jellyfin to the browser is to serve it under a **sub-path of the same domain as Tentacle TV** (e.g. `tentacle.example.com/jellyfin`). Same origin → no preflight, no `Access-Control-Allow-Origin` headers to maintain, no Cloudflare worker.

#### Step 1 — Tell Jellyfin to live under `/jellyfin`

In **Jellyfin → Dashboard → Networking → Base URL**, set:

```
/jellyfin
```

Save and **restart Jellyfin** (`docker restart jellyfin` or the equivalent). Without a restart Jellyfin keeps using the old base URL.

#### Step 2 — Trust the reverse proxy

In **Jellyfin → Dashboard → Networking → Known Proxies**, add the IP of your NPM container (e.g. `172.16.1.30`). Otherwise Jellyfin discards `X-Forwarded-For` / `X-Forwarded-Proto` and may reject HLS requests with `401`.

In **Jellyfin → Dashboard → Networking → Published Server URIs**, add:

```
all=https://tentacle.example.com
```

This is the URL Jellyfin advertises to clients (including Tentacle TV mobile/desktop) — it must match what the browser sees.

#### Step 3 — Add a Custom Location in NPM

On the existing **Tentacle proxy host** (`tentacle.example.com`), open the **Custom locations** tab and **Add location**:

| Field | Value |
|-------|-------|
| **Location** | `/jellyfin` |
| **Scheme** | `http` |
| **Forward Hostname / IP** | your Jellyfin container IP (e.g. `172.16.1.30`) |
| **Forward Port** | `8096` |

Click the **gear icon next to the location** (not the one at the top of the modal) → toggle **Enable Websockets Support** ON. Jellyfin's SyncPlay and live updates need it.

#### Step 4 — Cloudflare DNS only (if you use Cloudflare)

In your Cloudflare DNS panel, set the record for `tentacle.example.com` to **DNS only** (grey cloud, not orange). Cloudflare's proxy combined with Jellyfin sub-paths consistently breaks HTTP/2 and WebSocket upgrades. Keep it grey for streaming.

#### Step 5 — Configure Tentacle's Direct Streaming admin

In **Tentacle admin → Direct Streaming**, set both URLs to the new same-domain URL:

```
Public URL  : https://tentacle.example.com/jellyfin
Private URL : https://tentacle.example.com/jellyfin
```

(Or your LAN URL on the private side if your LAN clients should hit Jellyfin directly.)

#### Verify

```bash
curl -sI "https://tentacle.example.com/jellyfin/web/main.jellyfin.bundle.js" \
  | grep -iE "content-type|server"
```

You must see `content-type: application/javascript`. If you see `text/html`, the Custom Location didn't take effect (the request is hitting Tentacle's SPA shell) — double-check the location path and reload NPM.

#### Recovery if you mistyped Jellyfin's BaseURL

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

### 5. Direct Streaming with a separate Jellyfin subdomain (CORS) — alternative

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

---

## Desktop App

The desktop app wraps the web client with [Electron](https://www.electronjs.org/) on all three systems, and adds a native **mpv** video player for superior playback (Direct Play, Dolby Vision, Atmos).

### Installation

| OS | Format | Source |
|----|--------|--------|
| Windows | MSIX | [Microsoft Store](https://apps.microsoft.com/detail/9NKHL0T84245) |
| macOS | App Store | [App Store](https://apps.apple.com/app/id6760205634) |
| Linux | `.deb` · `.rpm` · `.AppImage` · `.pkg.tar.zst` | [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases) (tag `desktop-v*`) |

### Linux

Four packages, and **mpv is bundled in every one of them** — nothing else to install.

**One command, any distribution** — detects the format, installs the right package
and adds the menu entry (`--uninstall` removes both):

```bash
curl -fsSL https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/scripts/install-linux.sh | sh
```

Or by hand:

```bash
sudo apt install ./tentacle-tv_*_amd64.deb        # Debian / Ubuntu / Mint / Pop!_OS
sudo dnf install ./tentacle-tv_*.x86_64.rpm       # Fedora / openSUSE / RHEL
sudo pacman -U ./tentacle-tv_*.pkg.tar.zst        # Arch / Manjaro / EndeavourOS
chmod +x tentacle-tv_*.AppImage && ./tentacle-tv_*.AppImage   # any distribution
```

The AppImage needs FUSE (`fuse2` on Arch, `libfuse2t64` on Ubuntu); the install
script above says so if it is missing.

#### HDR, Wayland and X11

Linux forces a trade-off no other system does, and the app adapts to your session:

| Session | Video window | HDR |
|---------|--------------|-----|
| **Wayland** | fullscreen while playing | **yes**, real PQ / BT.2020 passthrough |
| **X11** | windowed, like Windows and macOS | no — tone-mapped to SDR |

Two facts are behind it. **X.Org will never support HDR** — it has been stated
officially, there is no protocol and there will not be one; HDR on Linux goes
through the Wayland `wp-color-management-v1` protocol. And **Wayland does not let
an application position its own windows**, so the video window can only be pinned
to the interface in fullscreen, where there is only one possible position.

HDR needs a Wayland session with a colour-managed compositor (KDE Plasma 6.2+,
GNOME 48+, Hyprland), plus Mesa 25.1+ or NVIDIA 595+. X11 sessions need a
compositing window manager — every modern desktop has one — otherwise the
controls paint black over the video.

> Windows and macOS update through their stores. **Linux has a built-in
> updater**: it detects how the app was installed (`.deb`, `.rpm`, pacman or
> AppImage), verifies the SHA-256 and installs through polkit — or swaps the
> AppImage file in place.

### First Launch

1. Enter the URL of your Tentacle TV server (e.g. `http://192.168.1.100` or `https://tentacle.example.com`)
2. Sign in with your Jellyfin credentials
3. Start watching

---

## Android TV App

The Android TV app uses **ExoPlayer (Media3)** for all video playback — direct play with hardware decoding for all common codecs. Player architecture inspired by [VoidTV for Jellyfin](https://github.com/hritwikjohri/VoidTV-for-jellyfin).

### Codec Support (Direct Play)

| Codec | Decoding | Notes |
|-------|----------|-------|
| **H.264 / AVC** | Hardware (MediaCodec) | All Android TV devices |
| **HEVC / H.265** | Hardware (MediaCodec) | Shield, Chromecast, Fire TV, etc. |
| **VP9** | Hardware (MediaCodec) | Wide device support |
| **AV1** | FFmpeg (dav1d) | Software decode via Jellyfin FFmpeg decoder |
| **Dolby Vision P8** | Hardware (MediaCodec) | Native DV decoder on supported devices |
| **Dolby Vision P7** | DvCompatRenderer | P7→P8.1 rewrite for device compatibility |

Codec errors trigger an automatic fallback to server-side transcoding (H.264 + AAC).

### Audio Passthrough

`DefaultAudioSink` with real device `AudioCapabilities` for bitstream passthrough over HDMI:

| Format | Passthrough | Notes |
|--------|-------------|-------|
| AC3 / EAC3 | Yes | Wide device support |
| EAC3 JOC (Dolby Atmos) | Yes | If device/AVR reports `ENCODING_E_AC3_JOC` |
| TrueHD (Dolby Atmos) | Yes | Nvidia Shield only |
| DTS / DTS-HD MA | Yes | Shield and select devices |
| Fallback | PCM decode | Automatic when passthrough unavailable |

### Installation

```bash
cd apps/tv/android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## Environment Variables

None is required with the stacks: the database comes from the stack (or the setup wizard), Jellyfin from the
wizard. Full list in [docs/server/install.md](docs/server/install.md#settings-env).

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL`, or `DB_HOST` · `DB_PORT` · `DB_NAME` · `DB_USER` · `DB_PASSWORD` / `DB_PASSWORD_FILE` | The database, given by the environment instead of the wizard | — |
| `PORT` | Server listening port | `3000` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PUID` / `PGID` | Account the server runs as (the image starts as root only to fix the data folder's ownership) | `1000` |
| `RATE_LIMIT` | Max requests per minute per IP | `1000` |
| `TRUSTED_PROXIES` | Extra proxies (IPs/CIDRs) whose `X-Forwarded-For` is trusted — neighbours (local and Docker networks) always are | — |
| `REMOTE_CHECK_URL` | Remote access test service; `off` disables the test | `https://check.tentacletv.app` |
| `TENTACLE_PUBLIC_URL` | Fallback public link (the one set in the administration wins) | — |
| `CORS_ORIGIN` | Allowed CORS origin (dev only) | — |
| `TENTACLE_IMAGE` | The image you deploy (e.g. `ghcr.io/knaox/tentacle-tv:v1.23.0`): the admin overview then gives the exact update command for a pinned tag | — |
| `TENTACLE_INSTALL_RUNTIME` | `docker`, `podman` or `none`: forces container detection where its marker file is missing (Kubernetes, LXC…) | auto |
| `TENTACLE_SERVER_UPDATE_REPO` | `off` turns off the update check (GitHub, at most every six hours) | Knaox/Tentacle-TV |

> Jellyfin URL and API key are configured through the web setup wizard and stored in the database — not in environment variables.

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [MariaDB](https://mariadb.org/) 11+ (or Docker)
- [Rust](https://www.rust-lang.org/) (only needed for desktop builds)

### 1. Clone and Install

```bash
git clone https://github.com/Knaox/Tentacle-TV.git
cd Tentacle-TV
pnpm install
```

### 2. Set Up the Database

**Option A — Docker (recommended):**

```bash
docker run -d \
  --name tentacle-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=tentacle \
  -e MYSQL_USER=tentacle \
  -e MYSQL_PASSWORD=tentacle \
  -p 3306:3306 \
  mariadb:11
```

**Option B — Local MariaDB:**

Create a database and user manually, then note the connection string.

### 3. Configure the Backend

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env`:

```env
DATABASE_URL="mysql://tentacle:tentacle@127.0.0.1:3306/tentacle"
JWT_SECRET=any_random_string_for_dev
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

> Use `127.0.0.1` instead of `localhost` for MariaDB connections — MySQL interprets `localhost` as a Unix socket, which may fail with Docker.

### 4. Initialize Prisma

```bash
cd apps/backend
pnpm db:generate   # Generate Prisma client
pnpm db:push       # Sync schema to database
cd ../..
```

### 5. Build Plugin Dependencies

```bash
cd apps/backend
pnpm build:shared-deps   # Downloads tailwind.js + bundles shared-deps.js
cd ../..
```

> This step is required for the plugin system to work. Without it, plugin pages will fail to load with a 404 on `tailwind.js`.

### 6. Start Development Servers

Run both in separate terminals:

```bash
pnpm dev:backend    # API server → http://localhost:3001
pnpm dev:web        # Web client → http://localhost:5173
```

The web dev server automatically proxies `/api/*` requests to the backend on port 3001.

### Other Dev Commands

```bash
# Desktop (requires Rust toolchain)
pnpm dev:desktop

# Code quality
pnpm lint           # ESLint across all packages
pnpm typecheck      # TypeScript --noEmit across all packages

# Database management (run from apps/backend/)
pnpm db:migrate     # Run Prisma migrations
pnpm db:studio      # Open Prisma Studio GUI

# Docker shortcuts
pnpm docker:up      # Start containers
pnpm docker:down    # Stop containers
pnpm docker:logs    # Tail container logs
pnpm docker:rebuild # Rebuild and restart
pnpm docker:reset   # Full teardown + rebuild (deletes data!)
```

---

## Project Structure

```
apps/
  web/             React 19 + Vite 6 + Tailwind CSS (main web client)
  backend/         Fastify 5 + Prisma 6 + MariaDB (API server)
  desktop-electron/ Electron (same web build for Windows, macOS and Linux)
  mobile/          Expo 52 + React Native (iOS + Android)
  tv/              React Native for Android TV (ExoPlayer/Media3)

packages/
  api-client/      Jellyfin API client + TanStack Query hooks
  shared/          Types, i18n translations, constants
  ui/              Shared React components (GlassCard, MediaCard, Shimmer)
  plugins-api/     Plugin system interfaces and registry

relay/             Cloudflare Worker for remote TV pairing

docs/              Plugin registry documentation
```

### Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Web App   │────▶│   Backend   │────▶│    MariaDB      │
│  (React 19) │     │ (Fastify 5) │     │  (Prisma ORM)   │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
┌─────────────┐            │            ┌─────────────────┐
│ Desktop App │────────────┘       ┌───▶│ Jellyfin Server │
│ (mpv native)│                    │    └─────────────────┘
└─────────────┘            ▲───────┘
                           │
                     /api/jellyfin/*
                      (proxy route)
```

**Two API targets from the frontend:**

1. **Tentacle Backend** (`/api/*`) — Authentication, invites, tickets, config, pairing, plugins
2. **Jellyfin** (`/api/jellyfin/*`) — Proxied through the backend — streaming, media browsing, user data

---

## Plugin Development

Tentacle TV supports a plugin system that lets you extend the client with custom pages and backend routes.

### Installing Plugins

1. Go to **Admin > Plugins > Marketplace**
2. Click **Install** on any available plugin
3. Configure the plugin in its settings tab
4. The plugin auto-appears in the navigation

### Adding Custom Registries

1. Go to **Admin > Plugins > Sources**
2. Click **Add source** with the URL to a `registry.json`
3. Plugins from the new source appear in the Marketplace

### Building a Plugin

A plugin implements the `TentaclePlugin` interface from `@tentacle-tv/plugins-api`:

```typescript
interface TentaclePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  routes: PluginRoute[];
  navItems: PluginNavItem[];
  adminRoutes?: PluginRoute[];
  adminNavItems?: PluginNavItem[];
  isConfigured(): boolean;
  initialize?(): void;
  destroy?(): void;
}
```

See [Plugin Registry Documentation](docs/plugin-registry-README.md) for the full registry format and archive structure.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web Frontend | React 19, Vite 6, Tailwind CSS 3, Framer Motion 11 |
| Desktop | Electron (Windows, macOS, Linux), native mpv player via koffi |
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| API Client | TanStack Query v5 |
| Language | TypeScript 5.7 (strict mode) |
| Video | hls.js 1.6 + HTML5 `<video>` (web), mpv (desktop), ExoPlayer/Media3 1.8 (TV) |
| i18n | i18next + react-i18next (English & French) |
| Validation | Zod 3.24 |
| CI/CD | GitHub Actions (Docker build on push to main) |

---

## Community

Join the **[Tentacle TV Discord](https://discord.gg/FRse3yMhnc)** to get help, share ideas and hear about new releases first. English and French are both welcome.

Rejoignez le **[Discord de Tentacle TV](https://discord.gg/FRse3yMhnc)** pour obtenir de l'aide, proposer des idées et suivre les nouveautés — annonces et salon de discussion en français.

Bugs and feature requests still go to [GitHub issues](https://github.com/Knaox/Tentacle-TV/issues).

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/Knaox/Tentacle-TV/issues) or submit a pull request.

By submitting a contribution, you agree that it is licensed under the same terms as Tentacle TV: the GNU AGPL v3.0 or later, together with the additional permission and terms of [`LICENSE-EXCEPTIONS`](LICENSE-EXCEPTIONS).

## License

Copyright (C) 2025-2026 Damien Rouge ("Knaox").

Tentacle TV is free software, licensed under the **[GNU Affero General Public License v3.0 or later](LICENSE)** (`AGPL-3.0-or-later`), with an additional permission for distribution through application stores and an additional term on trademarks — see [`LICENSE-EXCEPTIONS`](LICENSE-EXCEPTIONS).

In short: you may use, study, modify and share Tentacle TV. If you distribute a modified version, **or let people use it over a network** (for example as a hosted service), you must publish its complete source code under the same license.

- **Earlier versions stay MIT.** Every version released before 7 October 2026 (up to `desktop-v1.26.0`, `mobile-v1.10.2`, `tv-v1.10.0`, `server-v1.23.0`, `webos-v1.0.0`) was published under the MIT License, and those copies remain available under it.
- **Third-party components** keep their own licenses: see [`docs/LICENCES.md`](docs/LICENCES.md) and each app's `THIRD-PARTY-LICENSES.md`.
- **Name and logo**: "Tentacle TV" and its logos are not covered by the AGPL — see the [trademark policy](TRADEMARK.md).
