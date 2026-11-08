# Tentacle CEF — prototype

Prototype de client de bureau pour Tentacle TV sur l'architecture de la réécriture CEF de
Jellyfin Desktop (aujourd'hui `andrewrabert/jellium-desktop`) : **CEF** pour l'interface web,
**libmpv** pour la lecture, **SDL3** pour la fenêtre. Objectif premier : un vrai HDR/EDR sur
macOS. Linux et Windows viendront ensuite, sans refonte : tout ce qui dépend de l'OS vit
derrière `src/platform/`.

Importé dans le monorepo (`apps/desktop-cef`) depuis le dépôt local `Tentacle-CEF`, branche
`proto/cef-mpv-sdl3` au commit `0dbcfe7` ; son historique est resté dans ce dépôt-là.

- Contrat entre les modules : [docs/INTERFACES.md](docs/INTERFACES.md)
- Ce que le bureau Electron offre et que CEF n'a pas encore : [docs/PARITE-ELECTRON.md](docs/PARITE-ELECTRON.md)
- Étude de la référence : `docs/etude/` (écrite par les sessions du lot)
- Dépendances, builds, profils, médias de test : `~/.cache/tentacle-cef/` (hors dépôt)

## Lancer — sur le profil d'Electron

Depuis la racine du monorepo :

```bash
pnpm dev:cef                 # build web + build natif, puis l'app (son ouvert)
pnpm dev:cef -- --skip-web   # sans reconstruire apps/web/dist
pnpm dev:cef -- --mute       # son coupé
```

L'app charge le front du monorepo (`apps/web/dist`, construit pour la coquille de bureau comme
`pnpm dev:electron`) sous **`tentacle://app`**, l'origine d'Electron, et **partage le stockage
de ce front avec Electron** : session, adresse du serveur, réglages, cache d'Octave. Se
connecter dans l'un, c'est être connecté dans l'autre.

- **Profil d'Electron** : celui de `pnpm dev:electron` (`dataPaths.ts` : sous macOS
  `~/Library/Application Support/com.tentacle.media`). Autre dossier :
  `TENTACLE_ELECTRON_PROFILE=<dossier>` (l'app du Mac App Store vit dans son conteneur).
- **Ce qui est partagé** : `Local Storage` et `IndexedDB`, par des liens depuis le profil CEF
  (`~/.cache/tentacle-cef/profiles/electron/Default/`). Le reste du profil Chromium (cookies,
  cache, historique) reste à CEF : autre version de Chromium, autre disposition, autre clé de
  chiffrement des cookies. CEF garde ces bases en LevelDB, le format d'Electron
  (`src/shell/browser_app.cpp`).
- **Jamais les deux à la fois** : le lanceur refuse tant qu'un processus tient le profil
  d'Electron (son `SingletonLock`, les verrous LevelDB). Ouvrir Electron pendant que CEF tourne
  le ferait démarrer sur un stockage vide, en mémoire.
- **Quitter par Cmd+Q ou en fermant la fenêtre.** Chromium diffère l'écriture du stockage
  (5 s et plus) et ne la termine qu'à une fermeture normale. Ctrl+C dans le terminal (ou un
  `kill`) arrête tout sans elle : ce qui a été fait dans les dernières secondes — une
  connexion, un réglage — ne revient ni dans CEF ni dans Electron (mesuré).
- `TENTACLE_URL=<URL>` pose l'adresse du serveur dans le front s'il n'en a aucune.

## Autres commandes

Depuis `apps/desktop-cef` (ou `pnpm --filter @tentacle-tv/desktop-cef <script>`) :

```bash
pnpm banc up        # banc local (colima) ; `pnpm banc` affiche son état
pnpm dev:server     # mode des bancs : page servie par le banc (ou $TENTACLE_URL), profil à part
pnpm build          # le build natif seul (Release, ~/.cache/tentacle-cef/build/tv)
```

Détails des bancs : [docs/REPRISE.md](docs/REPRISE.md) (« Lancer », « Comment tester » — leurs
commandes `pnpm dev` y désignent aujourd'hui `pnpm dev:server`).
