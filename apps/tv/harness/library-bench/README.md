# Banc des bibliothèques (Apple TV)

L'app TV RÉELLE au simulateur, en JS de production, devant une grosse
bibliothèque (1 200 films) servie par un faux Tentacle + faux Jellyfin
CALIBRÉ sur le vrai serveur — sans compte, sans toucher au Jellyfin partagé
ni au backend de dev. On y mesure ce que l'utilisateur ressent dans une
bibliothèque : l'ouverture, le défilement rapide (flèche maintenue), les
affiches vides, les images/s, la RAM, le GPU. Écrit pour le chantier
« bibliothèques rapides » (`docs/TV-REFONTE.md`).

## Les pièces

| Fichier | Rôle |
|---|---|
| `server/` | Le faux serveur : routes Tentacle, faux Jellyfin (`jellyfin.mjs`, calibré), catalogue tiré de l'instantané du banc UI (`catalog.mjs`), lien modélisé (`transport.mjs`). Il RELAIE aussi Metro (paquet, inspecteur, sockets) et sert, sur demande, un paquet JS figé. |
| `prepareImages.mjs` | Les affiches de l'instantané réduites aux hauteurs que l'app demande (`sips`), une fois. |
| `probe/` | La sonde (jamais dans l'app) : images/s des fils UI et JS, chargement de chaque affiche, position de la grille (FlatList ou FlashList), navigation. |
| `metro.config.js` | L'enveloppe Metro : la sonde injectée à la place de `src/utils/screenMetricsDiag`, un cache à soi. |
| `measure.mjs`, `lib/` | Les scénarios et leur analyse ; `table.mjs` : les médianes. |
| `tools/` | RAM d'un processus (`ramsampler.py`), profils natifs d'xctrace (`xtp.py`, `xtpcallees.py`), profil Hermes par composant (`profcomp.py`). |

## Monter le banc

1. **L'instantané** du banc UI (`../ui-bench/snapshot`, voir son README) ; un
   worktree qui n'en a pas : `SNAP=<chemin>` vers celui d'un autre — ou
   `cp -c snapshot.json` et `cp -cR img`, JAMAIS `sessions/`.
2. **Les affiches** (~1 min) : `node prepareImages.mjs`.
3. **Le faux serveur** — un port à soi, Metro derrière :

   ```bash
   PORT=8660 METRO=8081 node server/fakeServer.mjs
   ```

4. **Metro**, depuis `apps/tv` : `react-native start --port 8081 --config harness/library-bench/metro.config.js`.
5. **Un simulateur à soi** (`simctl create`, Apple TV 4K 1080p), la build
   Debug de l'app installée (celle du lanceur convient si son natif est à
   jour). Simulateur ÉTEINT, dans la plist du CONTENEUR
   (`Library/Preferences/com.tentacle.mobile.plist`, `plistlib`) :
   `RCT_jsLocation` = `localhost:8660` (le faux serveur relaie Metro),
   `RCT_enableDev` = faux et `RCT_enableMinification` = faux (JS de
   production, noms lisibles au profileur), `tentacle_server_url` =
   `http://localhost:8660`, `tentacle_token` = `banc`, `tentacle_user` =
   `{"Id":"banc-user","Name":"Banc"}`.
6. **L'agent de télécommande** (`../atv-remote`, son README) sur des ports à
   soi : `AGENT_TCP=… AGENT_HTTP=… node server.mjs`, l'agent
   (`TEST_RUNNER_AGENT_PORT=…`, `-derivedDataPath` à soi), puis le démon CDP :
   `CDPD_PORT=… METRO_PORT=8081 node cdpd.mjs`.

## Mesurer

```bash
export BENCH_UDID=<simulateur> BENCH_PORT=8660 AGENT_HTTP=<…> CDPD_PORT=<…>
node measure.mjs cold && node measure.mjs relaunch
node measure.mjs open essai-open1
```

`relaunch` relance l'app à froid et pose le focus du rail sur « Films » :
`open` mesure depuis OK (1re affiche, premier écran complet). `hold` (flèche
BAS maintenue), `steps` (30 pas BAS à cadence fixe : le MÊME travail pour
toutes les versions), `trips` (allers-retours de bout en bout : RAM, tas JS).
`PROFILE=1` : profil Hermes du fil JS. Résultats dans `out/`.

**Comparer deux versions** : figer chaque paquet
(`curl -o bundles/<nom>.bundle "http://localhost:8081/index.bundle?platform=ios&dev=false&minify=false&app=com.tentacle.mobile"`,
avec le code de la version), puis `node measure.mjs ab <A> <B> 3` les joue en
alternance (le faux serveur sert le paquet nommé, client froid à chaque tour)
et `node table.mjs <A> <B>` en donne les médianes.

## Trace image par image : les creux de vitesse

Le compteur d'images ne voit qu'un fil qui rate des images. Une page qui
RALENTIT sans en rater (le « léger ralentissement » d'un défilement maintenu)
ne se voit qu'à sa position image par image : `probe/scrollTrace.js` la relève
sur le fil d'interface, à chaque image (`_measurePaper` du contenu de la
ScrollView de la grille, dans le runtime UI de Reanimated), avec les
événements de la télécommande et du focus (`TVEventHandler`). `lib/trace.mjs`
en tire la vitesse, les accrocs (> 25 et > 33 ms), la pire fenêtre de 250 ms
et les CREUX : la vitesse sous la moitié de sa pointe, puis de retour au-dessus
de 80 %. `timeline(rep, 100)` donne la chronologie par tranches de 100 ms.

```bash
node measure.mjs relaunch && curl -s -X POST localhost:$AGENT_HTTP/run -d '["select","wait:4"]'
node measure.mjs updown base 1      # out/base-down1, out/base-up1
node table.mjs base                 # lignes « BAS / HAUT maintenu (trace) »
```

Une version NATIVE se compare en installant tour à tour les deux builds
(`simctl install`, données gardées) avant chaque `relaunch` — même paquet JS.

## Lire une mesure

- Le Mac rend l'Apple TV simulée : sa charge (les builds des autres sessions)
  ralentit tout. Comparer en ALTERNANCE, et se fier d'abord à ce qui ne
  dépend pas d'elle : le temps CPU de l'app par ligne (`steps`), les affiches
  vides, le nombre de lignes parcourues. Au-delà d'une charge de ~50, les
  captures `simctl` arrivent avec des secondes de retard.
- Les chargements sont datés par la sonde, sur le fil JS : une borne haute
  (un fil JS occupé retarde l'avis du chargement, pas l'affichage).
- Simulateur 1080p (échelle 1) : sur une Apple TV 4K (échelle 2), une affiche
  décodée pèse 614 Ko au lieu de 369 — comparer des rapports, pas des Mo.

## Calibrage (2026-10-02, vrai serveur, lecture seule)

Jellyfin 10.11 derrière le backend de dev, compte de test : une page `Items`
coûte ~55 ms + 0,22 ms/Kio, plus 40 ms quand elle demande le total ; un film
pèse 1 Kio sans `MediaSources`, 7,6 Kio avec. Une affiche : ~7 ms à chaud,
80 à 270 ms à froid (une taille jamais demandée : Jellyfin la fabrique). Le
lien du téléviseur ajoute son débit (`/__mode?bw=50`, Mb/s).

## Pièges payés

- **Un appui maintenu de l'agent XCUITest ne tient pas plus d'~11 s** :
  `trips` enchaîne des appuis de 10 s jusqu'à ce que la position ne bouge plus.
- **Une Image d'iOS garde l'ancienne image** quand sa source change : une
  cellule recyclée montrait l'affiche précédente — d'où la clé par adresse
  des images des cartes.
- **Les exports de FlashList ne se redéfinissent pas** : la sonde capte ses
  instances par le prototype ; leur RecyclerListView est `rlvRef`, et leurs
  lignes se repèrent après l'en-tête (`distanceFromWindow`).
- **Un rapport qui n'est pas parti** laisse relire le précédent : la sonde
  vérifie l'étiquette.
- **`Object.assign` d'un forwardRef sur un autre** lui recopie son rendu :
  la sonde ne recopie que les statiques.
