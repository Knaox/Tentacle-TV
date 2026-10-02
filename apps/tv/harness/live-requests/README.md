# Banc des demandes en direct (Apple TV)

L'app TV RÉELLE au simulateur, avec des demandes Vigie qui AVANCENT — sans
compte, sans Vigie, sans Jellyseerr ni Sonarr/Radarr, sans rien demander à
personne. Un faux Tentacle et un faux Jellyfin (mode proxy : tout passe par
`/api/jellyfin`) servent l'instantané du banc UI (titres, affiches, accueil),
et un FAUX VIGIE (`fakeVigie.mjs`) répond au contrat `titles` : `access`, et
`mine`, dont la liste avance seule au fil de l'horloge, temps restant compris
(`etaSeconds`). Écrit pour le chantier « demandes en temps réel »
(`docs/TV-REFONTE.md`), étendu pour « Mes demandes = les demandes faites
depuis une TV » : chaque titre attendu porte l'origine de sa demande (« tv »,
ou faite ailleurs), et `mine?origin=tv` ne rend que celles d'une TV, comme
Vigie ≥ 1.22.

## 1. Le faux serveur

```bash
PORT=8767 SNAPSHOT_DIR=apps/tv/harness/ui-bench/snapshot node apps/tv/harness/live-requests/fakeServer.mjs
```

Il écoute 127.0.0.1 ET ::1 (l'app vise `http://localhost:<port>`). Sans
`SNAPSHOT_DIR`, l'instantané du banc UI à côté (`../ui-bench/snapshot`).
Depuis un autre dossier de travail, un dossier de LIENS vers `snapshot.json`
et `img/` seulement — jamais `sessions/` (des jetons d'appareil).

Scénario `live` (défaut) : « Projet Dernière Chance » en route de 18 % à 100
en 2 min, puis 12 s en mise en bibliothèque, 15 s sorti de la liste (arrivé),
et ça repart ; « Black Mirror » (saison 2) de 62 % en 6 min 40 ; une demande en
attente, une bloquée. Et la saga de « L'Attaque des titans : La dernière
attaque » (`/api/sagas/383987`, la réponse de l'instantané, affiches TMDB) :
son volet 1 est une demande qui avance (de 30 % en 1 min 30), son volet 2 une
demande en attente.

Origines : « Projet Dernière Chance », le volet 1 et la demande en attente
viennent d'une TV ; « Black Mirror », le volet 2 et la demande bloquée ont été
faits ailleurs. « Mes demandes » en montre donc 3, les cartes disent l'état
des 6 (le volet 2 reste « En attente » sur la saga).

```bash
curl "http://localhost:8767/__mode?vigie=blocked"
```

| Paramètre | Effet |
|---|---|
| `vigie=on` | Vigie actif, contrat complet (défaut) |
| `vigie=off` | aucune extension active : la TV ne montre rien de Vigie |
| `vigie=blocked` | compte sans droit (`access` → `request: false`) : rien non plus |
| `vigie=old` | Vigie d'avant `access` / `mine` : rien non plus |
| `vigie=noorigin` | Vigie d'avant l'origine (1.21) : il ignore le filtre, la liste entière |
| `scenario=live` | deux titres en route (défaut) |
| `scenario=still` | rien n'avance (en attente, bloquée) : les rythmes lents |
| `scenario=empty` | aucune demande : l'aperçu vide |
| `demandes=on` | un titre absent s'offre à la demande ; `POST titles/request` l'ajoute à la liste du banc, avec son origine (en attente 8 s, en route 60 s, puis arrivé) — défaut `off` : refusé |

`/__request?key=movie:714194&origin=web` : une demande faite AILLEURS (sans
origine ; `origin=tv` : comme d'une TV ; `&seasons=2,3` : des saisons d'une
série) ; `/__mine` : la liste du banc avec
l'origine de chaque titre. `/__log` : chaque lecture de la Vigie, horodatée
(le rythme se lit là), et chaque demande reçue avec son origine et sa
plateforme ; `/__reset` : vide le journal et les demandes du banc, l'horloge
des titres repart. La liste des extensions est gardée 10 min par l'app :
après `vigie=…`, relancer l'app.

Les SAISONS (`fakeSeasons.mjs`) : la fiche de « GTO - Great Teacher Onizuka »
(`navigate("MediaDetail", { itemId: "52665ab1c968caf9c32b3ef48f69b3f0" })`)
sert sa bande des saisons depuis l'instantané (saison 1), et le faux Vigie
`titles.gaps` / `titles.seasons` : il lui manque « Specials », « Season 2 »,
« Shonan 14 Days » (saison 3) — à demander — et « Season 4 », demandée par
quelqu'un d'autre ; des noms TMDB en anglais, comme Vigie les relaie.

## 2. L'app

Un clone de simulateur À SOI, une build Debug de l'app (les vues natives du
lot : désaturation, sections), un Metro à soi sur le dossier de travail.
Simulateur ÉTEINT, dans le plist du conteneur (`plistlib`) : `RCT_jsLocation`
= `localhost:<port Metro>`, `tentacle_server_url` = `http://localhost:<port>`,
`tentacle_token` = `banc` (bidon), `tentacle_user` =
`{"Id":"banc-user","Name":"Knaoxtest"}`, `tentacle_language` = `fr`.

Le focus se pilote par CDP (Hermes, via Metro) sans télécommande : la fibre
`RedesignScreen` porte `screen.focus` (`claim("nav:Requests")` ouvre le rail
sur l'aperçu), la fibre `RequestsDock` son `onSelect` (la fenêtre).

## 3. Ce qu'on éprouve

| Cas | Attendu |
|---|---|
| Rail replié, ouvert, aperçu focalisé | l'éventail, ce qui bouge devant ; son affiche se colore, le camembert avance |
| Fenêtre ouverte | chaque ligne avance d'une seconde à l'autre ; `mine` lue toutes les 10 s |
| Une demande arrive | « Mise en bibliothèque » (camembert plein, pleine couleur), puis « Disponible », puis elle sort |
| La fiche du film (`navigate("MediaDetail", { itemId: "f461dd313e49d9bde1d226d22fe4ed08" })`), focus sur la saga | le volet 1 avance d'une seconde à l'autre, `mine` lue toutes les 10 s ; arrivé, plus rien ne se relit |
| App en arrière-plan | aucune lecture ; au retour, UNE lecture, puis 10 s |
| `scenario=still` | fenêtre ouverte : 30 s ; rail seul : rien (5 min) |
| `vigie=off`, `blocked` | ni aperçu ni lecture de `mine` |
| « Mes demandes » (`demandes=on`) | le rail et la fenêtre ne lisent que `mine?origin=tv` : 3 titres, pas « Black Mirror » ni le volet 2 |
| OK sur un volet libre de la saga | `POST titles/request` avec `origin: "tv"`, `platform: "appletv"` (journal) ; il paraît aussitôt dans « Mes demandes », avance, puis sort |
| `/__request?…&origin=web` | rien de plus dans « Mes demandes » ; sa carte, elle, dit « En attente » |
| `vigie=noorigin` | la liste entière, comme avant : rien ne casse |
| Fiche de GTO, bande des saisons | « Spéciaux », « Saison 2 », « Saison 3 · Shonan 14 Days », « Saison 4 » (horloge) — jamais « Season 2 » |
| OK sur le « + » d'un onglet grisé | `POST titles/request` avec `seasons: [n]` et l'origine ; l'onglet dit « En attente » et son camembert, garde le focus |
| Feuille des saisons de GTO | « Toutes les saisons manquantes » en tête ; OK coche ; Lecture/Pause demande ce qui est coché, sinon la saison focalisée, tout depuis « Toutes » ; « Lecture/Pause : demander » au pied |

## Pièges

- Sous forte charge du Mac, le premier paquet dépasse le délai de l'app
  (« Could not connect to development server ») : le préchauffer par `curl`
  sur Metro avant de lancer.
- L'app peut rester derrière l'accueil de tvOS après un lancement : un second
  `simctl launch` (sans `--terminate-running-process`) la ramène.
- Jamais le vrai Vigie, ni le Jellyfin partagé : ce banc n'en a pas besoin.
