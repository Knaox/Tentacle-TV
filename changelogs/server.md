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

## [1.5.0]
### FR
- Notifications push mobile : le serveur peut désormais notifier l'app mobile lors de nouveaux ajouts en bibliothèque et — si le plugin Seer est actif — quand un contenu demandé par l'utilisateur devient disponible (nouveaux endpoints `/api/push` : enregistrement du jeton, préférences opt-in, notification de test).
### EN
- Mobile push notifications: the server can now notify the mobile app about new library additions and — when the Seer plugin is active — when content requested by the user becomes available (new `/api/push` endpoints: token registration, opt-in preferences, test notification).

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
