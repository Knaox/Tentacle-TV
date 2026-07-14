# Changelog — Serveur (backend + web, image Docker)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/server.yml` :
quand `versions.json` → `server` change dans un push sur `main`, une Release
GitHub `server-vX.Y.Z` est créée avec ces notes. Chaque push publie l'image
`ghcr.io/knaox/tentacle-tv` (`:latest` + `:v<server>`).

## [Unreleased]
### FR
- …
### EN
- …

## [1.5.3]
### FR
- Notifications d'ajouts en bibliothèque : la notification affiche désormais le titre exact du contenu (film, série, saison, ou épisode au format SxxExx) au lieu d'un libellé générique.
### EN
- Library-addition notifications: the notification now shows the exact title of the added content (movie, series, season, or episode in SxxExx format) instead of a generic label.

## [1.5.2]
### FR
- Notifications d'ajouts en bibliothèque : détection basée sur le nombre total d'items (fiable même quand Jellyfin date les contenus selon le fichier et non la date d'ajout), avec le titre récupéré quand c'est possible.
### EN
- Library-addition notifications: detection based on the total item count (reliable even when Jellyfin dates content by file date rather than add date), with the title fetched when available.

## [1.5.1]
### FR
- Notifications d'ajouts en bibliothèque : détection fiabilisée par interrogation périodique de Jellyfin (ne dépend plus uniquement de l'événement temps réel, qui pouvait être manqué) — les nouveaux contenus déclenchent désormais la notification de façon robuste.
### EN
- Library-addition notifications: detection made reliable via periodic polling of Jellyfin (no longer relying solely on the real-time event, which could be missed) — new content now triggers the notification reliably.

## [1.5.0]
### FR
- **Notifications push mobile** : l'app peut désormais recevoir des notifications même fermée. Deux réglages (Profil › Préférences › Notifications, opt-in) : nouveaux **ajouts en bibliothèque**, et — si le plugin Seer est actif — **contenu demandé disponible** (uniquement ses propres demandes). Nouveaux endpoints serveur `/api/push` (enregistrement du jeton Expo, préférences, notification de test réservée aux admins). Livraison via Expo Push → APNs (iOS) / FCM (Android).
### EN
- **Mobile push notifications**: the app can now receive notifications even when closed. Two opt-in settings (Profile › Preferences › Notifications): new **library additions**, and — when the Seer plugin is active — **requested content available** (your own requests only). New server `/api/push` endpoints (Expo token registration, preferences, admin-only test notification). Delivery via Expo Push → APNs (iOS) / FCM (Android).

## [1.4.1]
### FR
- Jumelage : un appareil (Android TV / Apple TV) dont le jumelage est révoqué est désormais déconnecté immédiatement et renvoyé à l'écran de jumelage — auparavant il pouvait rester connecté jusqu'à un échec d'authentification ultérieur (voire indéfiniment s'il restait inactif).
### EN
- Pairing: a device (Android TV / Apple TV) whose pairing is revoked is now disconnected immediately and sent back to the pairing screen — previously it could stay connected until a later authentication failure (or indefinitely if left idle).

## [1.4.0]
### FR
- Streaming direct : le serveur re-fournit automatiquement un jeton Jellyfin valide (repris d'un autre appareil du compte) quand celui d'un appareil jumelé est expiré ou absent — au jumelage et via `/api/config/streaming`. Requis par l'app TV pour la récupération automatique après une erreur de lecture.
### EN
- Direct streaming: the server now automatically re-provisions a valid Jellyfin token (borrowed from another device on the account) when a paired device's token is expired or missing — at pairing time and via `/api/config/streaming`. Required by the TV app for automatic recovery after a playback error.

## [1.3.0]
### FR
- Version courante du serveur (historique antérieur : voir CHANGELOG.md racine)
### EN
- Current server version (older history: see root CHANGELOG.md)

---
