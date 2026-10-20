# Watch Together — le banc et ses mesures

Rapport du banc `apps/server-e2e/wt-bench/` (mode d'emploi dans son README).
Ce document consigne ce qui a été MESURÉ, scénario par scénario, avant et
après les correctifs du lot du 20/10 (« mobile = bureau »). Le modèle de
synchronisation lui-même est décrit dans `WATCH-TOGETHER-SYNC.md`.

## Méthode, en deux lignes

Tous les membres tournent sur le même Mac ; la position de chaque lecteur est
lue DANS l'app avec l'heure murale commune, puis ramenée à un instant commun.
La dérive est donc la vérité terrain, pas ce que les lecteurs croient.

Cibles du lot : **< 100 ms en régime**, **retour < 1 s après un seek**.

_(Sections remplies au fil des passages — voir plus bas.)_
