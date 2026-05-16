<p align="center">
  <img src="apps/web/public/tentacle-logo-pirate.svg" alt="Tentacle TV" width="120" />
</p>

<h1 align="center">Tentacle TV</h1>

<p align="center">
  <strong>A premium, modern media client for Jellyfin</strong>
</p>

<p align="center">
  <a href="#quick-start-docker"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
  <img src="https://img.shields.io/badge/version-1.0.0-8b5cf6" alt="Version" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  Browse and stream your Jellyfin library through a sleek, dark-themed interface with glassmorphism design, smooth animations, and powerful features — all self-hosted.
</p>

<p align="center">
  <img src="docs/screenshot-home.png" alt="Tentacle TV — Home" width="800" />
</p>

---

## Platforms

| Platform | | Status | Technology |
|----------|---|--------|------------|
| **Web** | ![Yes](https://img.shields.io/badge/-Yes-22c55e?style=flat-square) | ![Available](https://img.shields.io/badge/Available-22c55e?style=flat-square) | React 19 + Vite 6 + Tailwind CSS |
| **macOS** | ![Yes](https://img.shields.io/badge/-Yes-22c55e?style=flat-square) | <a href="https://tentacletv.app/"><img src="apps/web/public/tentacle-logo-pirate.svg" height="18" align="absmiddle" alt="Tentacle" /> &nbsp;tentacletv.app</a> | Tauri v2 + native mpv player (signed & notarized) |
| **Windows** | ![Yes](https://img.shields.io/badge/-Yes-22c55e?style=flat-square) | <a href="https://apps.microsoft.com/detail/9NKHL0T84245"><img src="https://img.shields.io/badge/Microsoft_Store-0078D4?style=flat-square&logo=microsoftstore&logoColor=white" alt="Microsoft Store" /></a> | Tauri v2 + native mpv player |
| **iOS** | ![Yes](https://img.shields.io/badge/-Yes-22c55e?style=flat-square) | <a href="https://apps.apple.com/app/id6760205634"><img src="https://img.shields.io/badge/App_Store-000000?style=flat-square&logo=apple&logoColor=white" alt="App Store" /></a> | React Native + Expo |
| **Android** | ![No](https://img.shields.io/badge/-No-ef4444?style=flat-square) | ![Coming soon](https://img.shields.io/badge/Coming_soon-6b7280?style=flat-square) | React Native + Expo |
| **Android TV** | ![No](https://img.shields.io/badge/-No-ef4444?style=flat-square) | ![Not available](https://img.shields.io/badge/Not_available-6b7280?style=flat-square) | React Native + ExoPlayer/Media3 |
| **Apple TV** | ![No](https://img.shields.io/badge/-No-ef4444?style=flat-square) | ![Coming soon](https://img.shields.io/badge/Coming_soon-6b7280?style=flat-square) | React Native (tvOS) |

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

## Quick Start (Docker)

The fastest way to get Tentacle TV running. You only need Docker. Two deployment options are available.

### Option A — All-in-one (recommended)

Includes MariaDB and Tentacle TV in a single stack. Use the provided [`docker-compose.yml`](docker-compose.yml):

```yaml
services:
  db:
    image: mariadb:11
    container_name: tentacle-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: CHANGE_ME_ROOT_PASSWORD
      MYSQL_DATABASE: tentacle_db
      MYSQL_USER: tentacle_user
      MYSQL_PASSWORD: CHANGE_ME_DB_PASSWORD
    volumes:
      - tentacle-db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: ghcr.io/knaox/tentacle-tv:latest
    container_name: tentacle-tv
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://tentacle_user:CHANGE_ME_DB_PASSWORD@db:3306/tentacle_db
      JWT_SECRET: CHANGE_ME_LONG_RANDOM_SECRET
      PORT: "3000"
      HOST: "0.0.0.0"
    volumes:
      - tentacle-data:/app/apps/backend/data
    ports:
      - "3000:3000"

volumes:
  tentacle-db-data:
  tentacle-data:
```

> **Important:** Replace `CHANGE_ME_ROOT_PASSWORD`, `CHANGE_ME_DB_PASSWORD` and `CHANGE_ME_LONG_RANDOM_SECRET` with secure values. The password in `MYSQL_PASSWORD` must match the one in `DATABASE_URL`. You can generate secrets with `openssl rand -base64 32`.

```bash
docker compose up -d
```

### Option B — External database

If you already have a MariaDB/MySQL instance (NAS, dedicated server, cloud), use [`docker-compose.external.yml`](docker-compose.external.yml):

```yaml
services:
  web:
    image: ghcr.io/knaox/tentacle-tv:latest
    container_name: tentacle-tv
    restart: unless-stopped
    environment:
      JWT_SECRET: CHANGE_ME_LONG_RANDOM_SECRET
      PORT: "3000"
      HOST: "0.0.0.0"
    volumes:
      - tentacle-data:/app/apps/backend/data
    ports:
      - "3000:3000"

volumes:
  tentacle-data:
```

```bash
docker compose -f docker-compose.external.yml up -d
```

The database connection is configured through the setup wizard on first launch and persisted in the `tentacle-data` volume.

### Configure

Open `http://<your-server>:3000` in your browser. The setup wizard will guide you through:

1. **Database** — Auto-detected (Option A) or enter your connection details (Option B)
2. **Jellyfin** — Enter your Jellyfin server URL and verify the connection
3. **Admin account** — Sign in with your Jellyfin admin credentials

That's it. You're ready to stream.

---

## Reverse Proxy (Nginx Proxy Manager)

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

The `directStreamingConfigured: true` confirms the admin toggle stays ON; `transport: "proxy"` confirms the per-session fallback engaged. Native apps (Tauri desktop, mobile, Android TV) are unaffected — they have no CORS and continue full-direct.

---

## Desktop App

The desktop app wraps the web client with [Tauri v2](https://v2.tauri.app/) and adds a native **mpv** video player for superior playback (Direct Play, Dolby Vision, Atmos).

### Installation

Download the latest installer from [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases):

| OS | Format |
|----|--------|
| Windows | `.msi` or `.exe` (NSIS) |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` |

The app auto-updates via the built-in Tauri updater.

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

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | MariaDB connection string | — | Yes |
| `JWT_SECRET` | Secret key for JWT token signing | — | Yes |
| `PORT` | Server listening port | `3000` | No |
| `HOST` | Server bind address | `0.0.0.0` | No |
| `RATE_LIMIT` | Max requests per minute per IP | `1000` | No |
| `CORS_ORIGIN` | Allowed CORS origin (dev only) | — | No |

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
  desktop/         Tauri v2 (wraps web build for native desktop)
  mobile/          Expo 52 + React Native (coming soon)
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
│  (Tauri v2) │                    │    └─────────────────┘
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
| Desktop | Tauri v2 (Rust), mpv native player |
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| API Client | TanStack Query v5 |
| Language | TypeScript 5.7 (strict mode) |
| Video | hls.js 1.6 + HTML5 `<video>` (web), mpv (desktop), ExoPlayer/Media3 1.8 (TV) |
| i18n | i18next + react-i18next (English & French) |
| Validation | Zod 3.24 |
| CI/CD | GitHub Actions (Docker build on push to main) |

---

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/Knaox/Tentacle-TV/issues) or submit a pull request.

## License

[MIT](LICENSE) — Copyright (c) 2025 Knaox
