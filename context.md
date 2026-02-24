# Project Context: TENTACLE (Premium Media Ecosystem)

## Vision
Tentacle est un ecosysteme media multi-plateforme ultra-performant. Il se compose d'un frontend client premium (surpassant Plex en fluidite et design) branche sur l'API Jellyfin pour le streaming, et d'un backend personnalise (Node.js/MariaDB) pour gerer un systeme d'inscription exclusif sur invitation.

## Architecture & Tech Stack Rules
- **Structure**: Monorepo pnpm (apps/web, apps/desktop, apps/mobile, apps/backend, packages/ui, packages/api-client, packages/shared)
- **Frontend Frameworks**: React 19 (Web/Vite) / React Native avec Expo (Mobile) / Tauri v2 (Desktop)
- **Backend Framework**: Node.js + Fastify 5 avec Prisma 6 (ORM) et base de donnees MariaDB.
- **Styling**: Tailwind CSS 3 (Web/Desktop), NativeWind 4 (Mobile). Style "Glassmorphism", UI sombre.
- **Data Fetching**: TanStack Query v5 (React Query) obligatoire pour le cache agressif cote client.
- **Animations**: Framer Motion 11 (Web/Desktop) / Reanimated (Mobile) pour des transitions fluides a 60fps.
- **Video**: Video.js 8 (Web), react-native-video 6 (Mobile). Direct Play prioritaire.

## Coding Standards (STRICT)
1. **Regle des 300 Lignes MAX**:
   - AUCUN fichier (composant, hook, controleur backend) ne doit depasser 300 lignes de code.
   - Si la limite est atteinte, le fichier DOIT etre refactorise et decoupe en sous-composants, hooks personnalises ou fichiers utilitaires.
2. **Performance First**:
   - Utilisation de `memo`, `useCallback` et `useMemo` pour eviter les re-renders inutiles.
   - Lazy loading des images avec squelettes de chargement (shimmer effect).
3. **Video Optimization**:
   - Prioriser le "Direct Play". Buffer pre-charge de 30 secondes.
   - Gestion intelligente des erreurs de codec (Fallback automatique vers transcodage Jellyfin).
4. **Clean Code & Securite**:
   - Composants fonctionnels uniquement. Separation stricte entre la logique (Hooks) et l'affichage (UI). Typage TypeScript strict obligatoire partout.
   - La cle API Admin Jellyfin ne vit QUE dans le `.env` du backend Node.js, JAMAIS dans le frontend.
5. **UI Style**: Theme sombre, glassmorphism, accents gradient (purple -> pink). Feeling premium.

## API Flow & Endpoints Key

### 1. Custom Backend API (MariaDB) - URL: `BACKEND_URL` (default: http://localhost:3001)
- `POST /api/auth/register` : Verifie la cle d'invitation, cree l'user sur Jellyfin via l'API Admin, marque la cle comme utilisee, et renvoie les identifiants/token.
- `POST /api/invites` : Cree une nouvelle cle d'invitation (admin only).
- `GET /api/invites` : Liste toutes les cles d'invitation (admin only).
- `GET /api/health` : Health check.

### 2. Jellyfin API (Streaming/Media) - URL: `JELLYFIN_URL` (Direct Frontend -> Jellyfin)
- Auth Header: `X-Emby-Token` (Token de l'utilisateur standard)
- Auth: `POST /Users/AuthenticateByName`
- Libraries: `GET /UserViews`
- Items: `GET /Items` (filtre par ParentId)
- Stream: `GET /Videos/{Id}/stream` (HLS/Direct)
- Images: `GET /Items/{Id}/Images/{type}`

## Monorepo Architecture Detail
```
Tentacle/
├── apps/
│   ├── web/          -> React 19 + Vite 6 + Tailwind CSS (main web client)
│   ├── desktop/      -> Tauri v2 (wraps apps/web for native macOS/Windows)
│   ├── mobile/       -> Expo 52 + React Native 0.76 + NativeWind
│   └── backend/      -> Fastify 5 + Prisma 6 + MariaDB (invitation & auth API)
├── packages/
│   ├── shared/       -> TypeScript types, constants (used by all apps)
│   ├── api-client/   -> Jellyfin API client + TanStack Query hooks
│   └── ui/           -> Shared React UI components (GlassCard, MediaCard, Shimmer)
```

## Package Dependencies
```
@tentacle/web        -> @tentacle/ui, @tentacle/api-client, @tentacle/shared
@tentacle/desktop    -> @tentacle/web (Tauri wraps the web build)
@tentacle/mobile     -> @tentacle/shared (uses own UI with NativeWind)
@tentacle/backend    -> @tentacle/shared
@tentacle/ui         -> framer-motion (peer: react)
@tentacle/api-client -> @tentacle/shared, @tanstack/react-query (peer: react)
```

## Key Commands
```bash
pnpm dev:web       # Start web dev server (port 5173)
pnpm dev:backend   # Start backend dev server (port 3001)
pnpm dev:desktop   # Start Tauri desktop app
pnpm dev:mobile    # Start Expo mobile app
pnpm build:web     # Build web for production
pnpm build:backend # Build backend for production
```

## Database Schema (Prisma/MariaDB)
- `invite_keys`: id, key (unique), maxUses, currentUses, expiresAt, createdBy
- `invite_usages`: id, inviteKeyId, jellyfinUserId, username, usedAt

## Server Deployment
- Git bare repo: `/var/repo/tentacle.git`
- Source checkout: `/var/repo/tentacle-source`
- Web served by Nginx: `/var/www/tentacle`
- Backend: runs as systemd service on port 3001
- Deploy: `git push production main` triggers post-receive hook
