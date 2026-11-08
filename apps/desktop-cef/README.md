# Tentacle CEF — prototype

Prototype de client de bureau pour Tentacle TV sur l'architecture de la réécriture CEF de
Jellyfin Desktop (aujourd'hui `andrewrabert/jellium-desktop`) : **CEF** pour l'interface web,
**libmpv** pour la lecture, **SDL3** pour la fenêtre. Objectif premier : un vrai HDR/EDR sur
macOS. Linux et Windows viendront ensuite, sans refonte : tout ce qui dépend de l'OS vit
derrière `src/platform/`.

Importé dans le monorepo (`apps/desktop-cef`) depuis le dépôt local `Tentacle-CEF`, branche
`proto/cef-mpv-sdl3` au commit `0dbcfe7` ; son historique est resté dans ce dépôt-là.

- Contrat entre les modules : [docs/INTERFACES.md](docs/INTERFACES.md)
- Étude de la référence : `docs/etude/` (écrite par les sessions du lot)
- Dépendances, builds, médias de test : `~/.cache/tentacle-cef/` (hors dépôt)

## Lancer

```bash
pnpm banc up      # banc local (colima) ; `pnpm banc` affiche son état
pnpm dev          # vrai build Release puis l'app contre le banc, avec le son (`pnpm dev -- --mute` : muet)
pnpm build        # le build seul
```

Autre serveur : `TENTACLE_URL=https://… pnpm dev`. Détails : [docs/REPRISE.md](docs/REPRISE.md) (« Lancer »).
