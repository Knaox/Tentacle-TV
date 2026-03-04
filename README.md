<p align="center">
  <img src="apps/web/public/tentacle-logo-pirate.svg" alt="Tentacle TV" width="120" />
</p>

<h1 align="center">Tentacle TV</h1>

<p align="center">
  <strong>A premium, modern media client for Jellyfin</strong>
</p>

<p align="center">
  <a href="#quick-start-docker"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
  <img src="https://img.shields.io/badge/version-1.0.0--beta-8b5cf6" alt="Version" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  Browse and stream your Jellyfin library through a sleek, dark-themed interface with glassmorphism design, smooth animations, and powerful features — all self-hosted.
</p>

---

## Platforms

| Platform | Status | Technology |
|----------|--------|------------|
| **Web** | Available | React 19 + Vite 6 + Tailwind CSS |
| **Desktop** | Available | Tauri v2 + native mpv player (Windows, macOS, Linux) |
| **Mobile** | Coming soon | React Native + Expo (iOS & Android) |
| **Android TV** | Coming soon | React Native (Android TV) |
| **Apple TV** | Coming soon | React Native (tvOS) |

---

## Features

### Video Playback
- HTML5 player (web) with HLS streaming via hls.js
- Native mpv player (desktop) with Direct Play, Dolby Vision, and Atmos support
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

The fastest way to get Tentacle TV running. You only need Docker.

### 1. Create a `docker-compose.yml`

```yaml
services:
  db:
    image: mariadb:11
    container_name: tentacle-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: change_me_root_password
      MYSQL_DATABASE: tentacle_db
      MYSQL_USER: tentacle_user
      MYSQL_PASSWORD: change_me_password
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
      DATABASE_URL: mysql://tentacle_user:change_me_password@db:3306/tentacle_db
      JWT_SECRET: change_me_to_a_long_random_secret
      PORT: "3000"
      HOST: "0.0.0.0"
    ports:
      - "80:3000"

volumes:
  tentacle-db-data:
```

> **Important:** Replace `change_me_root_password`, `change_me_password`, and `change_me_to_a_long_random_secret` with your own secure values. Make sure the password in `MYSQL_PASSWORD` matches the one in `DATABASE_URL`.

### 2. Start

```bash
docker compose up -d
```

### 3. Configure

Open [http://localhost](http://localhost) in your browser. The setup wizard will guide you through:

1. **Database** — Already configured via Docker Compose (auto-detected)
2. **Jellyfin** — Enter your Jellyfin server URL and verify the connection
3. **Admin account** — Sign in with your Jellyfin admin credentials

That's it. You're ready to stream.

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

### 5. Start Development Servers

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
  tv/              React Native for Android TV (coming soon)

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
| Video | Video.js 8 + hls.js (web), mpv (desktop) |
| i18n | i18next + react-i18next (English & French) |
| Validation | Zod 3.24 |
| CI/CD | GitHub Actions (Docker build on push to main) |

---

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/Knaox/Tentacle-TV/issues) or submit a pull request.

## License

[MIT](LICENSE) — Copyright (c) 2025 Knaox
