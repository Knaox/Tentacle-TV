# Banc du contrôle parental — Tentacle ne montre que ce que Jellyfin montre

Prouve de bout en bout qu'un compte restreint ne voit, par AUCUNE route du cœur ni de Vigie, un
titre que Jellyfin lui cache — et aucun titre extérieur (TMDB) au-dessus de son âge ou sans
classification (docs/DROITS-UTILISATEURS.md § 5 et § 9.5). **Jamais lancé par `pnpm test`.**
Jamais contre le Jellyfin réel (dev et prod le partagent) : tout se passe sur un Jellyfin JETABLE.

```bash
# depuis apps/backend — Docker (colima) démarré
PARENTAL_TMDB_FROM="/chemin/vers/apps/backend/data/tentacle.db" \
PARENTAL_VIGIE="/chemin/vers/Tentacle-Plugin-Seer" \
pnpm bench:parental
```

Dure 10 à 15 min (dont le scan, la première fois). Sortie : « AUCUNE FUITE » (code 0), sinon
chaque fuite nommée (code 1) ; le relevé complet va dans `$PARENTAL_RUN/report.txt`.

## Ce qu'il monte

- **Jellyfin 10.11 jetable** `jf-parental` (127.0.0.1:8915, volumes `jf-parental-*`) : une
  médiathèque factice fabriquée par le ffmpeg de l'image (`catalog.ts`) — films et séries aux
  classifications françaises de la table de Jellyfin (`U`, `6+`, `10`, `12`, `16`, `18`, `X`, et
  AUCUNE), une étiquette bloquée, de vrais identifiants TMDB ; quatre bibliothèques (Films,
  Séries, « Réservée », « Réservée séries »). Comptes : `enfant6` (≤ 6 ans, non classés bloqués,
  étiquette « cauchemar », les deux « Réservée » refusées), `filmsseuls` (Films seule, AUCUN
  contrôle parental), `libre` (le témoin), et un invité de la Famille de `libre` (« Petit »,
  ≤ 6 ans) ouvert sur une Apple TV.
- **Le vrai backend du dépôt** (tsx, port 3115), base SQLite jetable, clé TMDB réelle si on la
  lui donne ; **Vigie** installée depuis son dépôt (`server/index.mjs`), devant un **faux
  Jellyseerr** (8916) dont les listes ne portent que de vrais identifiants TMDB.
- **Un passé** d'avant la restriction (`historySeed.ts`) : vus, en cours, favoris (Jellyfin),
  séances mesurées et avis (base de Tentacle) sur des titres interdits — et des témoins permis.

## Ce qu'il vérifie

- **La référence, c'est Jellyfin** : ce que l'API de Jellyfin montre au compte, par SON jeton
  (`reference.ts`). Chaque réponse de Tentacle est lue en entier : aucun id ni nom d'un titre
  interdit (`judge.ts`) ; la bibliothèque complète du proxy est ÉGALE à la référence.
- **Les titres extérieurs** sont relus chez TMDB par un oracle indépendant du cœur
  (`externalOracle.ts`) : classification FR, sinon US, ≤ 6 ans, jamais `adult` ni sans
  classification.
- **Chaque porte** (`doors.ts`) : session personnelle (web, bureau), TV jumelée par le vrai flux
  d'appareil, « voir en tant que », session de profil d'un invité (TV).
- **Chaque chemin** : listes du proxy (vues, derniers ajouts, reprise, à suivre, recherche, par
  parent, par série, par ids), accès DIRECTS par id (fiche, PlaybackInfo, flux, manifeste,
  vignettes, semblables) — `probesLibrary.ts` ; Pour vous (pages, rangées, coldstart, personnes),
  Affiner (pile, versos), recherche et épisodes, sagas, héros, résolutions TMDB, bandes-annonces et
  aperçus (sans extraction YouTube), segments, téléchargements, statistiques, notifications —
  `probesCore.ts` ; Vigie (découverte, tendances, recherche, semblables, saga, filmographie, fiche,
  saisons, pastilles, saisons manquantes, demandes) — `probesVigie.ts`.

## Variables

| Variable | Défaut | |
|---|---|---|
| `PARENTAL_TMDB_FROM` | — | une base Tentacle dont lire la clé TMDB (lecture seule) ; ou `PARENTAL_TMDB_KEY` |
| `PARENTAL_VIGIE` | — | le dépôt de Vigie (construit : `server/index.mjs`) ; absent, Vigie n'est pas éprouvée |
| `PARENTAL_RUN` | `$TMPDIR/tentacle-parental-bench` | dossier du passage (base, journal, `state.json` 0600, relevé) |
| `PARENTAL_KEEP` | — | `1` : garder le Jellyfin jetable à la fin (sinon conteneur et volumes supprimés) |
| `PARENTAL_PORT`, `PARENTAL_JF_PORT`, `PARENTAL_SEERR_PORT` | 3115, 8915, 8916 | |

Sans clé TMDB, recommandations et titres extérieurs ne sont pas éprouvés (le banc le dit).

Pour itérer : `pnpm bench:parental -- --up` laisse le banc en service (Ctrl+C l'arrête) ;
`pnpm bench:parental -- --check` rejoue les vérifications contre lui. Les plafonds PAR ROUTE de
la production (jumelage : 10 par heure) restent : relancer `--up` entre deux `--check` répétés.

Arrêt manuel : `docker rm -f jf-parental && docker volume rm jf-parental-config jf-parental-cache jf-parental-media`.
