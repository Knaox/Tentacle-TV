# Changelog — Serveur (backend + web, image Docker)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/server.yml` :
quand `versions.json` → `server` change dans un push sur `main`, une Release
GitHub `server-vX.Y.Z` est créée avec ces notes. Chaque push publie l'image
`ghcr.io/knaox/tentacle-tv` (`:latest` + `:v<server>`).

## [Unreleased]
### FR
- Streaming direct : le serveur re-fournit automatiquement un jeton Jellyfin valide (repris d'un autre appareil du compte) quand celui d'un appareil jumelé est expiré ou absent — au jumelage et via `/api/config/streaming`
### EN
- Direct streaming: the server now automatically re-provisions a valid Jellyfin token (borrowed from another device on the account) when a paired device's token is expired or missing — at pairing time and via `/api/config/streaming`

## [1.3.0]
### FR
- Version courante du serveur (historique antérieur : voir CHANGELOG.md racine)
### EN
- Current server version (older history: see root CHANGELOG.md)

---
