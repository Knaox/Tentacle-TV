# Tentacle TV

**Client media moderne et multi-plateforme pour Jellyfin**

![Version](https://img.shields.io/badge/version-0.9.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Tentacle TV est un ecosysteme client media multi-plateforme connecte a votre serveur Jellyfin. Il offre une interface moderne et soignee pour parcourir et lire votre mediatheque sur tous vos appareils.

## Fonctionnalites

### Client multi-plateforme
- **Web** -- React 19 + Vite + Tailwind CSS
- **Desktop** -- Tauri v2 (Windows, macOS, Linux) avec lecteur mpv natif
- **Mobile** -- React Native / Expo (iOS, Android)
- **TV** -- React Native (Android TV) avec navigation D-pad

### Lecture video
- Lecteur HTML5 (web) avec support HLS
- Lecteur mpv natif (desktop) : Direct Play, Dolby Vision, Atmos
- Switch audio et sous-titres a la volee
- Reprise de lecture (continuer a regarder)
- Preferences par bibliotheque (langue audio, sous-titres par defaut)

### Interface
- Design premium dark/violet avec glassmorphisme
- Hero section dynamique avec rotation automatique
- Sidebar extensible au hover avec preview des bibliotheques
- Cartes media animees, animations CSS fluides
- Barre de recherche globale avec raccourci clavier
- Multi-langue (francais, anglais)
- 100% responsive

### Systeme de plugins
- Architecture extensible avec marketplace integre (admin web/desktop)
- Support de sources multiples (registres GitHub personnalises)
- Installation, mise a jour et desinstallation en un clic
- Integration automatique dans la navigation et les routes
- Les plugins ne s'affichent que s'ils sont installes ET configures
- Verification SHA256 et compatibilite de version a l'installation

### Plugin Seer -- Demandes de medias (optionnel)
- Integration Jellyseerr pour demander films et series
- Filtres par type (films, series, animes), tri par popularite/note/recent
- Demande de film en 1 clic, selecteur de saisons pour les series
- File d'attente serveur (retry automatique, max 10 tentatives)
- Gestion des demandes par utilisateur
- Suppression propre (Tentacle + Jellyseerr + Sonarr/Radarr)
- Configuration admin (URL, cle API, auto-approbation, limites)

### Autres fonctionnalites
- Systeme d'invitations pour controler les acces
- Tickets de support integres
- Appairage TV par code (confirme depuis le web)
- Notifications en temps reel

## Quick Start (Docker)

**1. Creer un fichier `docker-compose.yml` :**

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

**2. Demarrer :** `docker compose up -d`

**3. Ouvrir** [http://localhost](http://localhost) et suivre l'assistant de configuration.

## Configuration

Jellyfin et les services sont configures via l'interface web apres le premier lancement :

1. **Base de donnees** -- Pre-configuree via Docker Compose
2. **Jellyfin** -- Entrer l'URL du serveur et verifier la connexion
3. **Compte admin** -- S'authentifier avec les identifiants Jellyfin admin

Jellyseerr peut etre ajoute ensuite via Admin > Plugins > Seer.

## Developpement

### Prerequis
- Node.js >= 20
- pnpm >= 9
- Rust (pour le build desktop)
- MariaDB (ou Docker)

### Installation
```bash
git clone https://github.com/knaox/Tentacle-TV.git
cd Tentacle-TV
pnpm install
```

### Lancer en dev
```bash
pnpm dev:backend    # Backend (port 3001)
pnpm dev:web        # Frontend web (port 5173)
pnpm dev:desktop    # App desktop Tauri
pnpm dev:mobile     # App mobile Expo
pnpm dev:tv         # App TV
```

### Structure du projet
```
apps/
  web/        -- Frontend React 19 (Vite)
  backend/    -- API Fastify (Prisma + MySQL)
  desktop/    -- App desktop Tauri v2
  mobile/     -- App mobile Expo / React Native
  tv/         -- App Android TV React Native
packages/
  api-client/ -- Client API + hooks TanStack Query
  shared/     -- Types, i18n, utilitaires
  ui/         -- Composants React partages
  plugins-api/-- Interface systeme de plugins
  plugin-seer/-- Plugin Seer (demandes de medias)
scripts/      -- Scripts PowerShell de build/deploy
```

## Plugins

### Installer un plugin
1. Admin > Plugins > Marketplace
2. Cliquer "Installer"
3. Configurer dans l'onglet du plugin
4. Activer

### Ajouter une source de plugins
1. Admin > Plugins > Sources
2. "Ajouter une source" avec l'URL d'un `registry.json`
3. Les plugins apparaissent dans le Marketplace

### Developper un plugin
Un plugin implemente l'interface `TentaclePlugin` (voir `packages/plugins-api/src/types.ts`) et fournit routes, navigation, configuration admin, et logique serveur optionnelle.

## Distribution

| Plateforme | Methode |
|---|---|
| Desktop | GitHub Releases (auto via CI a chaque tag `v*`), Microsoft Store |
| Web | Docker (`ghcr.io/knaox/tentacle:latest`) ou hebergement statique |
| Mobile | Build via Expo / EAS |
| TV | APK via Gradle |

Auto-update desktop via Tauri Updater.

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend web | React 19, Vite 6, Tailwind CSS 3 |
| Desktop | Tauri v2, Rust, mpv |
| Mobile | React Native 0.76, Expo 52, NativeWind |
| TV | React Native tvOS |
| Backend | Fastify 5, Prisma 6, MariaDB |
| State | TanStack Query v5 |
| Langage | TypeScript 5 (strict) |
| CI/CD | GitHub Actions |

## Variables d'environnement

| Variable | Description | Defaut | Requis |
|---|---|---|---|
| `DATABASE_URL` | Connexion MariaDB | -- | Oui |
| `JWT_SECRET` | Secret pour les tokens JWT | -- | Oui |
| `PORT` | Port du serveur | `3000` | Non |
| `HOST` | Adresse de bind | `0.0.0.0` | Non |

Jellyfin et Jellyseerr sont configures via l'interface web et stockes en base.

## Licence

[MIT](LICENSE)

## Contribuer

Les contributions sont les bienvenues. Ouvrir une issue ou soumettre une PR sur [GitHub](https://github.com/knaox/Tentacle-TV).
