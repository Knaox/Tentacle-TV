# Bancs de test — où ils sont, à quoi ils servent

Index unique des bancs du dépôt, pour un humain comme pour un agent. Chaque banc
a son mode d'emploi à côté de lui (README) ; ici, seulement le chemin et l'usage.
Règles communes : un clone de simulateur PAR session (« Banc UI TV — <mot>
(Claude) »), ses propres ports, arrêt par PID (jamais `pkill -f`), et le clone
supprimé en fin de tâche — les simulateurs pèsent plusieurs Go chacun.
Jamais l'Apple TV « Chambre » ni les simulateurs de l'utilisateur ; jamais le
backend 3001 redémarré ; compte Knaoxtest seulement.

## Lancer l'app TV

| Commande | Rôle |
|----------|------|
| `pnpm tv:refonte` | L'app Apple TV au simulateur « Tentacle TV — refonte » (Metro + build) |
| `pnpm tv:banc` | Le banc UI (ci-dessous) au simulateur « Tentacle TV — banc UI » |
| `pnpm tv:stop` | Arrête ce que les deux commandes ont lancé |

Lanceur : `apps/tv/harness/launcher/cli.mjs`.

Apple TV PHYSIQUE (Release autonome, installée par-dessus) :
`apps/tv/harness/launcher/install-appletv-release.sh` (`--js-only` si seul le JS a changé ;
autre appareil : `APPLETV_DEVICE=<id>`).

## Bancs de l'app TV (`apps/tv/harness/`)

| Dossier | Ce qu'il éprouve |
|---------|------------------|
| `ui-bench/` | Les écrans de la refonte, scène par scène, sur données factices (`bench.mjs help`) |
| `library-bench/` | Bibliothèques : 1 200 films, faux Tentacle + faux Jellyfin, i/s et RAM, A/B |
| `live-requests/` | Demandes Vigie qui avancent, sans Vigie ni Jellyseerr |
| `slow-transcode/` | Serveur qui transcode lentement (encodeur réglable) |
| `atv-remote/` | Pilote de télécommande XCUITest + CDP (simulateur ; appareil réel seulement sur demande de l'utilisateur) |
| `vitrine/` | Visuels des stores et du site |

Jetons d'appareil de test (Knaoxtest, base de dev) : scripts hors dépôt,
`~/Desktop/Projet - local/_scripts/tentacle-jetons-test/` (LISEZMOI) ; fichiers
dans `apps/tv/harness/ui-bench/snapshot/sessions/` (ignorés par git).

## Autres

| Commande / dossier | Rôle |
|--------------------|------|
| `pnpm test:jellyfin-compat -- --version X` | Suite de compatibilité Jellyfin (backend) |
| `pnpm typecheck`, `pnpm lint`, tests par paquet | Le contrôle que rejoue `quality.yml` |

Le savoir des bancs (pièges, mesures) vit aussi dans la mémoire des agents :
fiches `reference_*` de MEMORY.md.
