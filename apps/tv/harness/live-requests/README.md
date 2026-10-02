# Banc des demandes en direct (Apple TV)

L'app TV RÉELLE au simulateur, avec des demandes Vigie qui AVANCENT — sans
compte, sans Vigie, sans Jellyseerr ni Sonarr/Radarr, sans rien demander à
personne. Un faux Tentacle et un faux Jellyfin (mode proxy : tout passe par
`/api/jellyfin`) servent l'instantané du banc UI (titres, affiches, accueil),
et un FAUX VIGIE répond au contrat `titles` : `access`, et `mine`, dont la
liste avance seule au fil de l'horloge, temps restant compris (`etaSeconds`).
Écrit pour le chantier « demandes en temps réel » (`docs/TV-REFONTE.md`).

## 1. Le faux serveur

```bash
PORT=8767 SNAPSHOT_DIR=apps/tv/harness/ui-bench/snapshot node apps/tv/harness/live-requests/fakeServer.mjs
```

Il écoute 127.0.0.1 ET ::1 (l'app vise `http://localhost:<port>`). Sans
`SNAPSHOT_DIR`, l'instantané du banc UI à côté (`../ui-bench/snapshot`).

Scénario `live` (défaut) : « Projet Dernière Chance » en route de 18 % à 100
en 2 min, puis 12 s en mise en bibliothèque, 15 s sorti de la liste (arrivé),
et ça repart ; « Black Mirror » (saison 2) de 62 % en 6 min 40 ; une demande en
attente, une bloquée.

```bash
curl "http://localhost:8767/__mode?vigie=blocked"
```

| Paramètre | Effet |
|---|---|
| `vigie=on` | Vigie actif, contrat complet (défaut) |
| `vigie=off` | aucune extension active : la TV ne montre rien de Vigie |
| `vigie=blocked` | compte sans droit (`access` → `request: false`) : rien non plus |
| `vigie=old` | Vigie d'avant `access` / `mine` : rien non plus |
| `scenario=live` | deux titres en route (défaut) |
| `scenario=still` | rien n'avance (en attente, bloquée) : les rythmes lents |
| `scenario=empty` | aucune demande : l'aperçu vide |

`/__log` : chaque lecture de la Vigie, horodatée (le rythme se lit là) ;
`/__reset` : vide le journal, l'horloge des titres repart. La liste des
extensions est gardée 10 min par l'app : après `vigie=…`, relancer l'app.

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
| App en arrière-plan | aucune lecture ; au retour, UNE lecture, puis 10 s |
| `scenario=still` | fenêtre ouverte : 30 s ; rail seul : rien (5 min) |
| `vigie=off`, `blocked` | ni aperçu ni lecture de `mine` |

## Pièges

- Sous forte charge du Mac, le premier paquet dépasse le délai de l'app
  (« Could not connect to development server ») : le préchauffer par `curl`
  sur Metro avant de lancer.
- L'app peut rester derrière l'accueil de tvOS après un lancement : un second
  `simctl launch` (sans `--terminate-running-process`) la ramène.
- Jamais le vrai Vigie, ni le Jellyfin partagé : ce banc n'en a pas besoin.
