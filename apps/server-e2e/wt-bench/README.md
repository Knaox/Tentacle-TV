# Banc Watch Together

Prouve que Watch Together marche de A à Z et mesure sa synchronisation, en
lecture directe ET avec un membre en transcodage. **Jamais lancé par
`pnpm test`.** Rapport chiffré : `docs/WATCH-TOGETHER-BANC.md`.

```bash
pnpm --filter @tentacle-tv/server-e2e bench:wt up               # ≈ 3 min la première fois
pnpm --filter @tentacle-tv/server-e2e bench:wt list
pnpm --filter @tentacle-tv/server-e2e bench:wt run              # tous les scénarios (≈ 15 min)
pnpm --filter @tentacle-tv/server-e2e bench:wt run sync-direct third-device
pnpm --filter @tentacle-tv/server-e2e bench:wt restart-backend  # après une fusion côté serveur
pnpm --filter @tentacle-tv/server-e2e bench:wt down [--purge]
```

## Ce qui tourne

| Service | Port | Détail |
|---|---|---|
| Jellyfin 10.11 officiel | 18830 | conteneur `wtbench-jf`, volumes `wtbench-*` ; série « WT Banc » (3 × 5 min, 720p 6 Mb/s, chapitres Intro 0–40 s et Générique, heure incrustée) |
| Backend du dépôt | 3830 | base SQLite jetable `.runs/wt/backend-data/`, `WT_DEBUG=1` |
| Client web (Vite) | 5830 | proxy `/api` vers 3830 |

Comptes : ceux de l'instance JETABLE (`compat-user`, `compat-user2`,
`wtbench-user3`, `wtbench-user4`) — jamais un compte réel. Ports surchargés par
`WT_JF_PORT`, `WT_BACKEND_PORT`, `WT_WEB_PORT`. Chaque processus est noté par
son PID dans `.runs/wt/state.json` : `down` n'arrête que les siens.

## Comment on mesure

Chaque membre est un contexte Chrome sans tête À LUI (un appareil). Toutes
les pages tournent sur le même Mac : `sample()` lit DANS la page, au même
instant, `video.currentTime` et l'heure murale (`performance.timeOrigin +
now()`). Les positions sont ramenées à un instant commun (extrapolées à la
vitesse du lecteur) : la dérive est l'écart à la référence (le membre A), en
ms, sans faire confiance à l'horloge synchronisée des lecteurs — la vérité
terrain, pas le `driftMs` qu'ils déclarent.

- **régime** : |dérive| p50 / p95 / max sur une fenêtre, et le **biais**
  (médiane signée) de chaque membre — un biais constant est un écart que la
  boucle croit corrigé ;
- **réaligné** : délai entre un geste (touche du lecteur : Espace, → +30 s,
  ← −10 s, N) et le premier de trois échantillons consécutifs alignés à
  < 100 ms (< 50 ms en pause) dans l'état attendu.

Transcodage : le banc impose à `PlaybackInfo` un plafond de 1,5 Mb/s (le
geste « qualité basse » d'un utilisateur) ; le mode effectif est relevé dans
les requêtes (HLS `master.m3u8` = transcodage). Membre lent : ses premières
requêtes média sont retardées (6 s). Arrière-plan : Chrome sans tête garde
tout onglet visible — le banc simule l'onglet caché (`visibilityState`) et le
gel de la page (`Page.setWebLifecycleState`), le cas d'une app iOS en
arrière-plan. Réseau : `context.setOffline` (requêtes et socket).

## Sorties

`.runs/wt/report.md` (dernier passage), `.runs/wt/results-*.json`, et par
scénario `.runs/wt/out/<id>/` : journal, captures, trames `wt:*` de chaque
membre, journaux de console `[WT…]`, points de mesure.

## iPhone et iPad

Les membres iOS passent par le simulateur (clones « WT banc iPhone/iPad
(Claude) », jamais le simulateur de base) ; leur position se lit par Hermes
(CDP de Metro). Voir `clients/README-ios.md` quand il existe.
