# Tentacle

**A premium media client for Jellyfin**

<!-- Badges -->
![Version](https://img.shields.io/badge/version-0.8.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Tentacle is a multi-platform media client ecosystem that connects to your Jellyfin server. It provides a polished, modern interface for browsing and streaming your media library across all your devices.

## Features

- **Multi-platform** — Web, Desktop (macOS/Windows), Mobile (iOS/Android), TV (Android TV)
- **Jellyfin integration** — Library browsing, playback, watch progress tracking
- **Overseerr/Jellyseerr integration** — Optional media request management
- **Support ticket system** — Built-in user support
- **Invitation system** — Control who can access your server
- **Multi-language** — French and English
- **Dark theme** — Glassmorphism design with smooth animations
- **TV remote support** — Full D-pad navigation for Android TV
- **Desktop native playback** — Dolby Vision and Atmos support via mpv (Tauri)

## Screenshots

<!-- Add screenshots here -->
<!-- ![Home](docs/screenshots/home.png) -->
<!-- ![Library](docs/screenshots/library.png) -->
<!-- ![Player](docs/screenshots/player.png) -->

## Quick Start (Docker)

Deploy Tentacle in 3 steps:

**1. Create a `docker-compose.yml` file:**

```yaml
services:
  db:
    image: mariadb:11
    container_name: tentacle-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root_password_123
      MYSQL_DATABASE: tentacle_db
      MYSQL_USER: tentacle_user
      MYSQL_PASSWORD: tentacle_password
    volumes:
      - tentacle-db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: ghcr.io/knaox/tentacle:latest
    container_name: tentacle-web
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://tentacle_user:tentacle_password@db:3306/tentacle_db
      JWT_SECRET: change-me-to-a-long-random-secret
      PORT: "3000"
      HOST: "0.0.0.0"
    ports:
      - "80:3000"

volumes:
  tentacle-db-data:
```

**2. Start the containers:**

```bash
docker compose up -d
```

**3. Open your browser:**

Go to [http://localhost](http://localhost) and follow the setup wizard.

> No `.env` file is required. Default values work out of the box.
> Only `JWT_SECRET` should be changed in production.

## Configuration

Jellyfin and Overseerr are configured through the web UI after first launch. The setup wizard guides you through:

1. **Database** — Connection is pre-configured via Docker Compose
2. **Jellyfin** — Enter your Jellyfin server URL and verify the connection
3. **Admin account** — Authenticate with your Jellyfin admin credentials

Overseerr/Jellyseerr can be added later in **Settings > Administration > Services**.

## Connecting Apps

Once the server is running, connect your apps:

1. Open the Tentacle app (Desktop, Mobile, or TV)
2. Enter your Tentacle server URL (e.g. `http://your-server-ip`)
3. Log in with your Jellyfin credentials

For TV devices, use the **pairing system**: the TV displays a code that you confirm from the web interface.

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- MariaDB (or use Docker for the database)

### Setup

```bash
git clone https://github.com/knaox/tentacle.git
cd tentacle
pnpm install
cp .env.example .env
# Edit .env with your local values
```

### Run in development

```bash
# Start backend (port 3001)
pnpm dev:backend

# Start web frontend (port 5173)
pnpm dev:web

# Start desktop app
pnpm dev:desktop

# Start mobile app
pnpm dev:mobile

# Start TV app
pnpm dev:tv
```

### Project structure

- apps/
  - web/ — React 19 web client (Vite)
  - backend/ — Fastify API server (Prisma + MariaDB)
  - desktop/ — Tauri v2 desktop wrapper
  - mobile/ — Expo + React Native mobile app
  - tv/ — React Native TV app
- packages/
  - shared/ — Constants, types, i18n
  - api-client/ — Jellyfin API hooks (TanStack Query)
  - ui/ — Shared React components

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web Frontend | React 19, Vite 6, Tailwind CSS 3 |
| Mobile | React Native 0.76, Expo 52, NativeWind 4 |
| Desktop | Tauri v2, mpv (native playback) |
| TV | React Native TV (tvOS fork) |
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| State Management | TanStack Query v5 |
| Language | TypeScript 5 (strict mode) |

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | MariaDB connection string | — | Yes |
| `JWT_SECRET` | Secret for signing auth tokens | — | Yes |
| `PORT` | Server port | `3000` | No |
| `HOST` | Server bind address | `0.0.0.0` | No |

Jellyfin and Overseerr URLs are stored in the database and configured through the web UI.

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/knaox/tentacle).
