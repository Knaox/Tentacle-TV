# Banc de référence de la navigation Apple TV (nav-golden)

L'extraction de la navigation vers `packages/tv-core` ne doit RIEN changer. Ce
banc le prouve : chaque scénario est joué sur le code d'origine (la
**référence**, `84f3cedd0` pour le lot d'octobre 2026) et son relevé est gardé ;
après chaque refactorisation, on le rejoue et on compare, pas par pas.

```bash
# depuis n'importe quel dossier de travail du dépôt, sur SA place (0 à 9)
node apps/tv/harness/nav-golden/nav-golden.mjs verify --slot 2            # tout
node apps/tv/harness/nav-golden/nav-golden.mjs verify --slot 2 focus      # un domaine
node apps/tv/harness/nav-golden/nav-golden.mjs record --slot 2 socle      # enregistrer (sur la référence)
```

Code de sortie 0 : tout est identique. 1 : un écart (ou un scénario non joué),
détaillé dans le terminal et dans `apps/tv/harness/nav-golden/out/`.

## Ce que le banc fait tourner

- **L'app réelle**, au simulateur tvOS (et sur l'Apple TV physique, plus
  bas) : la vraie navigation, de vrais appuis UIKit par l'agent XCUITest
  d'`atv-remote` — jamais un composant isolé.
- **Un faux backend** (`server/`) : faux Tentacle, faux Jellyfin (mode proxy),
  faux Vigie. Ses données sont l'**instantané du banc UI** (compte de test,
  `ui-bench/snapshot`, ignoré par git) FIGÉ par son empreinte dans le cache de
  la machine — jamais la bibliothèque vivante : le focus ne varie pas.
  `dataset.json` dit quelle empreinte le banc utilise ; une référence
  enregistrée ne se rejoue que sur les mêmes données.
- **Une sonde** (`probe/navProbe.js`), JAMAIS dans l'app : Metro la charge
  avant `src/App` (l'enveloppe `lib/metroConfig.cjs` remplace l'import de
  `./src/App` du point d'entrée par `probe/appEntry.js`, qui charge la sonde
  puis l'App réelle). Elle écoute le focus NATIF (événements focus/blur que
  RN-tvOS envoie pour chaque vue, avec son tag), dès la première image, et
  remonte l'arbre React de la vue focalisée jusqu'à sa `focusKey`. Elle ne lit
  aucun magasin de focus de l'app : la refactorisation peut les déplacer sans
  aveugler le banc. Modals comprises.

## La référence honnête : `record --at`

`record` joue le code d'un COMMIT, quel que soit l'état du dossier d'où on le
lance — la branche peut avoir déjà tout refactorisé :

1. le commit est extrait (`git archive` : `apps/tv`, `packages`, la racine
   utile) dans `~/Library/Caches/tentacle-nav-golden/checkouts/<sha>`, une fois
   pour toute la machine ;
2. il emprunte les node_modules du dossier principal (liens paquet par paquet ;
   les liens `@tentacle-tv/*` restent relatifs : c'est le tv-core DE LA
   RÉFÉRENCE qui est servi) ;
3. Metro sert CE dossier-là (le banc relance Metro quand on passe de la
   référence au dossier courant) ; un module tiers est toujours pris dans le
   principal, pour la référence comme pour le code refactorisé ;
4. le binaire natif est le même pour les deux s'ils ont le même natif : il est
   rangé dans le cache sous l'**empreinte du natif** (fichiers natifs du
   checkout, lockfile et correctifs du principal, version de Xcode) — un
   changement natif ferait reconstruire, une fois.

Sans `--at`, `record` prend la `reference` du fichier de scénarios. `verify`
joue le dossier courant (ou `--at <rév>`), modifications non commitées
comprises (le banc le signale).

## Places, simulateurs, ressources

Une **place** `n` par session : Metro `818n`, démon CDP `923n`, faux backend
`310n`, agent XCUITest `875n` (TCP) et `876n` (HTTP), simulateur `nav-T<n>`
(ou `--sim <nom|udid>`). Un port se force un par un (`NAV_GOLDEN_METRO`…).
Le simulateur est créé neuf s'il manque ; un simulateur existant est
**effacé** (`simctl erase`) au premier usage par la place — un clone peut
porter une vraie session (`--no-erase` pour s'en passer, à ses risques).
Il démarre SANS Simulator.app (la rouvrir renverrait les apps des autres
sessions à l'accueil). Les services restent lancés entre deux commandes ;
`down --slot n` les arrête, par PID (jamais `pkill -f`), `--sim-off` éteint le
simulateur.

Avant CHAQUE scénario : démarrage à froid — app tuée, ses préférences et
fichiers effacés, session factice posée (faux backend, jeton bidon, compte de
test en NOM seulement), faux backend remis à la base puis aux jeux du scénario.
Aucun scénario ne dépend d'un autre.

## Écrire un scénario

Un fichier `scenarios/<domaine>/<nom>.json` — les `*.json` À LA RACINE du
dossier du domaine ; les sous-dossiers ne sont pas lus (un domaine y range ce
qui n'est pas un scénario du simulateur).

```json
{
  "domain": "socle",
  "reference": "84f3cedd0",
  "defaults": { "settleMs": 0 },
  "scenarios": [
    {
      "id": "socle-03",
      "title": "Rail → Films → Retour",
      "why": "facultatif : ce que le scénario garde",
      "start": { "keys": ["left", "down", "down", "down", "down", "down"], "focus": "nav:Library_db4c1708cbb5dd1676284a40f2950aba" },
      "steps": [
        { "do": "select", "settleMs": 800, "expect": { "route": "Library", "focus": "grid:0" } },
        { "do": "menu", "expect": { "focus": "nav:Library_db4c1708cbb5dd1676284a40f2950aba" }, "why": "facultatif" }
      ]
    }
  ]
}
```

**`start`** (tout facultatif) : `session` `paired` (défaut) | `none` (écran de
jumelage) · `fixtures` : jeux de données `<domaine>/<jeu>` · `route` :
`{ name, params, reset? }` — `navigationRef.navigate` depuis l'accueil (pile
`[Home, route]`), ou `reset: true` (pile `[route]`) · `keys` : gestes
d'approche · `focus` / `screen` : préconditions vérifiées après l'approche ·
`storage` : clés de l'app posées avant le lancement (chaînes ; un JSON en
chaîne).

**`do`** : un geste, ou une liste de gestes (relevé seulement à la fin) —
`up` `down` `left` `right` `select` `menu` `play` `home` · `hold:<s>` (OK
maintenu) · `holdup|holddown|holdleft|holdright:<s>` · `wait:<s>` ·
`type:<texte>` (clavier système) · `activate` (ramène l'app, sans relancer) ·
`swipe:<dir>` et `pan:<dx>,<dy>[,<ms>]` (balayage et glissé, par le chemin JS
de RN-tvOS — voir les limites) · `backend:<mode>=<valeur>` (change un mode du
faux backend en cours de route, ex. `backend:health=down`).

**`settleMs`** : attente minimale avant le relevé (fondus, entrées décidées
après un délai) ; le banc attend de toute façon que le relevé soit STABLE
(identique 500 ms d'affilée), au plus `timeoutMs` (8 s par défaut).

**`expect`** — ce que l'auteur affirme, vérifié dès l'enregistrement :
`focus` (clé) · `label` · `route` · `stack` (noms de la pile) · `params`
(sous-ensemble) · `panel` `open|closed` (une Modal ouverte) · `writes` (liste
exacte, `[]` = aucune) · `text` (un ou plusieurs textes montés dans l'écran
courant ou une Modal ouverte — pas une visibilité stricte) · `frame`
`[x, y, l, h]` (±2 pt, `null` pour ignorer une valeur) · `app`
`foreground|background` · `storage` `{ clé: valeur }`.

Écritures du faux backend : `watchlist:add|remove`, `favorite:add|remove`,
`watched:add|remove`, `rating:<1-10>|remove`, `reco:feedback:<type>`,
`vigie:request`, `playback:info|start|stop`, `prefs:<nom>`, sinon
`<MÉTHODE> <chemin>`. Chaque écriture porte son item (`watchlist:add @<id>`) ;
un attendu sans `@` ne compare que le genre.

Pour trouver une clé ou un chemin, explorer l'app :

```bash
node …/nav-golden.mjs start --slot 2 socle/accueil-rail#socle-01   # démarrage à froid sur l'entrée d'un scénario
node …/nav-golden.mjs do --slot 2 left down down select            # gestes, clé après chacun, relevé final
node …/nav-golden.mjs obs --slot 2                                 # le relevé courant
node …/nav-golden.mjs check                                        # validation, sans simulateur
node …/nav-golden.mjs show socle/rail                              # relit une référence, pas par pas
```

## Ce que le banc relève, et compare

Après chaque pas : `focus` (la `focusKey` de l'élément focalisé), `label`
(son libellé d'accessibilité, sinon ses textes), `frame` (son cadre en points),
`groups` (les clés des groupes qui l'entourent), `route`, `params`, `stack`,
`panel` (la première clé de chaque Modal ouverte), `writes`, `app`, et `texts`
/ `storage` quand le pas les demande.

`verify` compare STRICTEMENT tout, sauf `frame` (±2 pt) ; `groups` et le
composant d'une Modal sont signalés en note, jamais comptés (renommer un
groupe ne change pas le comportement). `record` joue chaque scénario DEUX fois
(`--repeat`) : un champ qui varie entre deux passages est marqué instable et
ignoré par `verify` ; si c'est la clé, la route, la pile, la Modal ou les
écritures, le scénario est dit **instable** (non fiable, à revoir).

Statuts : `✓` identique · `●` enregistré · `✗` écart · `≠` attendu de l'auteur
contredit · `~` identique mais le scénario a changé depuis sa référence
(réenregistrer) · `∅` pas de référence · `⌀` référence d'une sonde plus
ancienne (à réenregistrer) · `≈` instable · `?` approche ratée · `!` le banc
n'a pas pu le jouer · `-` ignoré (`"skip": "<raison>"`).

Chaque référence porte la version du relevé (`observation`, 2 depuis la
lecture des textes) : `verify` refuse une référence plus ancienne. Un scénario
en échec est rejoué une fois (`--retries 1`, `0` pour aucune) et dit « au 2e
essai » s'il passe alors ; un enregistrement instable est repris une fois. Les
écritures d'UN pas se comparent sans leur ordre (deux requêtes parallèles
arrivent dans un ordre qui varie) ; l'ordre entre les pas compte.

**Attente du focus à l'entrée** : depuis `e4ff50fc0` (cherry-pick de
« l'entrée d'un écran lent attend son focus jusqu'à 10 s »), le relevé
d'entrée attend jusqu'à 10 s qu'un focus se pose. Une référence enregistrée
AVANT, dont l'entrée disait « focus absent » (∅) parce que l'écran chargeait
encore, peut diverger en `verify` sur ce seul champ : c'est ce changement du
banc, pas l'app — réenregistrer ce scénario.

**Un scénario instable** (`≈`) ne prouve rien : son relevé dépend du moment.
Les causes vues : un écran qui charge encore (le focus se pose tard — donner
`settleMs` au pas qui l'ouvre), une horloge de l'app (voile hors ligne après
~12 s, héros qui tourne, reconnexion après « Réessayer » : ne garder que la
partie stable), le faux Vigie vivant (`base/vigie-vivant`). `show` relit ce
qui a été enregistré ; on corrige le scénario, jamais l'app.

Un attendu contredit À L'ENREGISTREMENT n'empêche pas d'écrire la référence
(elle dit ce que fait le code d'origine) : c'est l'auteur qui se trompe, ou un
bug de la référence — à noter dans le rapport du domaine, jamais à corriger.

## Jeux de données

La base : l'instantané figé. Bibliothèques (ordre de `/Views`) : Animés
`acf898949f3c87c958b3784cb05fd4d1`, Films `db4c1708cbb5dd1676284a40f2950aba`,
Séries `d565273fd114d77bdf349a2896867069`. Reprendre 12, À suivre 12, Derniers
ajouts 36, Déjà vus 16, Ma liste 1, Favoris 1, Pour vous : la page reco
capturée. Tout se relit sur le faux backend de sa place
(`curl localhost:310n/api/jellyfin/Users/x/Views`, `…/Items/<id>`).

La base par défaut n'a PAS de réglages reco : `GET /api/preferences/reco` y
répond sans `settings`, et la requête des réglages reco de l'app échoue
(référence et code refactorisé de la même façon : l'équivalence tient, mais le
chemin « réglages présents » n'est pas couvert). Un domaine qui en a besoin
reprend la forme du jeu `focus/home` (`{ settings: { …, providerFilter },
vigieAvailable }`) ; à basculer dans la base après le lot. De même, les routes
que la base ne sert pas (`__unknown`) répondent 404 — l'app y suit ses chemins
d'erreur, identiques des deux côtés.

Jeux de la base (`base/<nom>`) : `serveur-coupe`, `serveur-muet`,
`sante-en-erreur`, `vigie-off`, `vigie-bloque`, `vigie-ancien`,
`vigie-vivant` (non déterministe), `vigie-vide`, `demandes-on`,
`bandes-annonces-en-panne`. Liste : `nav-golden.mjs sets`.

Le **point d'extension d'un domaine** : `scenarios/<domaine>/fixtures.mjs`.

```js
// Chaque jeu retouche la base ; un scénario le déclare : "fixtures": ["panneaux-cartes/film-note-7"].
export default {
  "film-note-7": (data) => data.rate("bc82e0bf6d59b1bf4586bb189ae305ae", 7),
  "film-non-notable": { description: "aucun identifiant TMDB", apply: (data) => data.makeUnratable("…") },
  "ma-liste-longue": (data) => data.setList("watchlist", ["…", "…", "…"]),
  "parcourir": (data) => data.route("GET", /^\/api\/search\/person\//, (req, res, { json }) => json(res, 200, { items: [] })),
};
```

`data` : `item(id)`, `patchItem(id, champs)`, `setUserData(id, champs)`,
`addItem({ from, id, ...champs })`, `setLibraries([{ id, name, collectionType, items? }])`, `setList(nom, ids)` (Ma liste et favoris
suivent les drapeaux `Likes` / `IsFavorite`), `rate(id, 1-10)`,
`makeUnratable(id)`, `setDetail(id, { similar, saga… })`, `route(méthode,
/regex/, (req, res, { url, body, data, json }) => …)`, `modes` (`health`,
`vigie`, `vigieScenario`, `demandes`, `trailers`), `snapshot` (l'instantané
brut, pour tout le reste). Le fichier est relu à chaque scénario. Une route
manquante se voit dans `GET localhost:310n/__unknown`.

## Durées (mesurées le 2026-10-03, Mac chargé, charge 13 à 30)

| Étape | Durée |
|---|---|
| `up` à froid (simulateur créé, app installée, Metro, agent compilé) | 1 min 30 |
| Bascule de Metro référence ↔ dossier courant (paquet compris) | 10 à 30 s |
| Démarrage à froid d'un scénario | 7 à 10 s |
| Un pas | 0,5 à 1,5 s (attente de stabilité comprise) |
| `record` de 3 scénarios (deux passages chacun) | 1 min 22 |
| `verify` de 3 scénarios (bascule de Metro comprise) | 49 s |
| `record` du socle : 21 scénarios, deux passages chacun (charge ~50) | 27 min 26 s |

Compter ~12 s par scénario de 4 à 6 pas en `verify`, le double en `record`.

## Apple TV physique (`--device`)

```bash
node apps/tv/harness/nav-golden/nav-golden.mjs verify --slot <n> --device [domaine]
```

Le même banc, sur l'Apple TV « Chambre » (UDID xcodebuild
`00008110-0015181621EB601E`, CoreDevice `DA96352F-A2B7-55A9-86B0-D087B44828B8` ;
une autre : `NAV_GOLDEN_DEVICE_UDID`, `NAV_GOLDEN_DEVICE_COREDEVICE`). Un
créneau à la fois : le demander au coordinateur, le rendre.

- **L'app de l'utilisateur n'est jamais touchée.** Le banc installe À CÔTÉ une
  app de TEST, `com.tentacle.mobile.navtest` : le même natif (build Debug
  appareil, `SKIP_BUNDLING=1`, signature automatique, équipe `96K3M57W49`),
  rangée dans le cache sous l'empreinte du natif — une build pour tout le
  lot, que chaque place réutilise. Avant le passage et après, le banc vérifie
  (`devicectl device info apps`) que `com.tentacle.mobile` est toujours là.
- **Jamais la vraie session** : Metro (`--host 0.0.0.0`) et le faux backend
  (toutes interfaces) sur l'IP du Mac (`ipconfig getifaddr en0`, ou
  `NAV_GOLDEN_MAC_IP`). L'app de test est lancée par `devicectl device process
  launch --terminate-existing` avec `-RCT_jsLocation <ip>:818n` (pas besoin
  d'`ip.txt` : l'argument vaut pour le port de la place) et
  `-navGoldenSession paired|none -navGoldenServer http://<ip>:310n
  [-navGoldenStorage <base64>]` : la sonde efface les clés `tentacle_*` de
  l'app de TEST et pose la session du banc avant que l'app ne lise son
  stockage. Ses autres fichiers (caches) ne sont pas effacés, contrairement
  au simulateur.
- **Une seule app relevée.** Le démon CDP de la place (`lib/cdpDaemon.mjs`)
  ne suit que l'app attendue dans l'inspecteur de Metro : `com.tentacle.mobile`
  sur le simulateur de la place (par son nom), `com.tentacle.mobile.navtest`
  sur l'appareil. L'app du simulateur restée ouverte et reconnectée au Metro
  relancé sur le réseau est donc écartée (passage de T5, où la sonde suivait
  le simulateur pendant que les gestes partaient à l'appareil). S'il reste
  plusieurs candidates plus de 10 s, le banc REFUSE de relever, avec leurs
  noms — rien n'est fermé d'office : fermer l'app en trop, ou changer de place.
- **L'agent XCUITest** d'`atv-remote` est compilé et signé pour l'appareil
  (cache de la machine) et vise `com.tentacle.mobile.navtest`
  (`TEST_RUNNER_AGENT_BUNDLE`) ; il se connecte au serveur de la place sur
  l'IP du Mac.
- Les références restent celles du SIMULATEUR : `verify --device` dit les
  écarts appareil / simulateur, sans rien réenregistrer. Pour comparer le
  matériel seul, jouer le code de la référence : `--at 84f3cedd0`.
- L'agent installe aussi son lanceur (`com.damienrouge.atvagent.uitests.xctrunner`).
  L'app de test s'affiche « Tentacle TV », comme celle de l'utilisateur : une
  prochaine build appareil lui donnera un nom distinct (« Tentacle NAV test »).

Mesuré le 2026-10-03 sur « Chambre » (AppleTV14,1, tvOS 26.6), Mac sur le même
réseau (Wi-Fi) :

| Étape | Durée |
|---|---|
| `up --slot n --device` la première fois (installation 98 Mo, agent signé, Metro sur le réseau) | 1 min 05 |
| Démarrage à froid d'un scénario (le paquet de 16 Mo redescend du Mac à chaque fois) | 10 à 12 s |
| Un scénario de 3 à 5 pas | 12 à 20 s (rail-01, 13 pas : 59 s) |

Écarts appareil / simulateur (code de la référence, références du simulateur) :
`socle/accueil-rail` 3/3, `socle/demarrage#demarrage-jumelage` 1/1,
`socle/rail` 4/5 — clés, libellés, routes, piles, Modals et cadres identiques
au point près ; trois Retour à la racine quittent l'app (`app: background`)
comme au simulateur. Le cinquième (`rail-03`) n'a pas été joué : l'agent est
resté muet le temps d'un `activate` — un accroc du lien, d'où le renvoi
automatique de cet ordre et la reprise d'un scénario en échec. Les appuis MAINTENUS dépendent
du temps, et diffèrent d'un cran :

| Geste maintenu | Simulateur | Apple TV |
|---|---|---|
| `holddown:2` depuis « Accueil », dans le rail | 4 entrées (Animés) | 5 entrées (Films) |
| `holdup:2` dans le rail | 4 entrées | 4 entrées |
| `holddown:3` dans une grille (6 colonnes) | 7 rangées (`grid:42`) | 6 rangées (`grid:36`) |
| `holdright:2` dans la grille | 5 cartes | 5 cartes |

Un scénario qui maintient une touche ne fige donc pas la case atteinte s'il
veut passer sur les deux (le simulateur seul, lui, reste stable d'un passage à
l'autre). Le balayage et le glissé RÉELS du pavé
ne se rejouent pas sans une main sur la télécommande : `swipe:` et `pan:`
n'éprouvent que le chemin JS, identique sur les deux.

En fin de lot, retirer l'app de test (l'app de l'utilisateur reste) :

```bash
xcrun devicectl device uninstall app --device DA96352F-A2B7-55A9-86B0-D087B44828B8 com.tentacle.mobile.navtest
```

## Limites connues

- **Balayage et glissé** : l'agent XCUITest n'a que des appuis (XCUIRemote).
  `swipe:` et `pan:` passent par le chemin JS de RN-tvOS (les événements
  `swipe*` / `pan` d'`onHWKeyEvent`) : ils éprouvent ce que l'app en fait,
  pas le moteur de focus natif de tvOS, qu'un vrai balayage déplace comme des
  flèches (avec élan). Le passage sur l'Apple TV physique dit les écarts.
- **Appui maintenu** : `holdX:<s>` tient au plus ~11 s (XCTest).
- `text` : un texte MONTÉ, pas forcément visible (une carte hors champ d'une
  rangée compte) ; le cadre fait foi pour « hors champ ».
- Les écrans gardés par la pile (react-native-screens) restent montés : la
  sonde ne cherche les textes que dans la scène de la route courante.
- La lecture vidéo : le faux Jellyfin ne sert pas de flux (le lecteur s'ouvre
  sur une erreur de lecture) ; les traces du lecteur ont leur banc
  (`apps/tv/harness/player-trace`, T5).
- LogBox est muet dans le paquet du banc (ses bandeaux prendraient le focus).

## Dépannage

Journaux d'une place : `~/Library/Caches/tentacle-nav-golden/slots/<n>-logs/`
(`metro.log`, `backend.log`, `agent.log`, `console.log` — la console JS de
l'app). « la sonde n'a pas paru » : écran rouge ou paquet en échec — lire
`metro.log`. « port pris » : une autre session est sur cette place. Un
service se relance seul quand son code change ; `down` puis la commande
remet tout à neuf.

## Tester le banc lui-même

```bash
node --test "apps/tv/harness/nav-golden/test/*.test.mjs"
```

Le choix de la cible Hermes et sa contre-épreuve : un faux inspecteur de Metro
à deux apps candidates → refus (409, message nommant les deux) ; l'app du
simulateur à côté de l'app de test → seule l'app de test suivie.

## Fichiers

| Chemin | Rôle |
|---|---|
| `nav-golden.mjs` | La commande |
| `lib/` | Checkouts, build natif en cache, simulateur, services, observation, comparaison, rapport |
| `probe/` | La sonde et son point d'entrée (dans le paquet du banc seulement) |
| `server/` | Le faux backend et ses jeux de données de base |
| `scenarios/<domaine>/` | Scénarios, références (`*.golden.json`), jeux du domaine (`fixtures.mjs`) |
| `dataset.json` | L'empreinte de l'instantané figé |
