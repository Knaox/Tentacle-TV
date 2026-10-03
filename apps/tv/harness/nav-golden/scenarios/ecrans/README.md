# Scénarios dorés — les écrans (T7)

La navigation PROPRE à chaque écran du chemin refondu d'Apple TV (relevé :
`docs/tv-navigation/ecrans.md`, dont ils citent les règles dans `rules`) :
fiche, recherche, Parcourir, grilles, bibliothèque, Ma liste et Favoris,
réglages, jumelage, bande-annonce, et les gestes « demander » de Vigie hors
feuilles. Enregistrés sur le SHA de référence **84f3cedd0**, rejoués en
`verify` après l'extraction : à l'identique.

## Format

Celui du banc (repris de T6) : un fichier par écran, `{ domain: "ecrans",
screen, scenarios: [...] }`. Un scénario :

| Champ | Sens |
|---|---|
| `id` | `ec-<écran>-<n>` (`fi` fiche, `re` recherche, `pa` Parcourir, `bi` bibliothèque et grilles, `co` Ma liste et Favoris, `rg` réglages, `ju` jumelage, `ba` bande-annonce, `vi` Vigie) |
| `title` | ce que le scénario éprouve, en une phrase |
| `rules` | les règles du relevé couvertes (`FI-3`, `RE-5`…) |
| `start` | `session` (`paired` : session factice vers le faux backend ; `none` : rien, l'app s'ouvre sur le jumelage), `fixtures` (jeux de données nommés, ci-dessous), `stack` (la pile posée avant le premier geste) ou `route`, `focus` (une clé à réclamer avant de commencer) |
| `steps` | `do` (geste de l'agent `atv-remote` : `up` `down` `left` `right` `select` `menu` `play`, `hold:<s>` OK tenu, `holddown:<s>` / `holdup:<s>` / `holdleft:<s>` / `holdright:<s>` flèche tenue, `type:<texte>` au clavier système ouvert, `\n` = sa validation, `wait:<s>`), `settleMs` (attente avant le relevé), `expect`, `why` |
| `expect` | `focus` (clé du magasin de focus de l'écran devant), `label` (libellé d'accessibilité), `route`, `stack` (noms de la pile), `panel` (`open` / `closed`), `keyboard` (clavier système ouvert), `writes` (écritures vues par le faux backend depuis le geste précédent ; `[]` = aucune), `unchanged` (le focus n'a pas bougé) |

Les `expect` ne disent que ce que le code GARANTIT (le relevé) ; tout le
reste — la clé focalisée, la route, la pile après CHAQUE geste — est relevé
à l'enregistrement et doit revenir à l'identique en `verify`.

## Jeux de données (`fixtures.mjs`, à brancher sur le banc de T2)

| Nom | Ce qu'il sert |
|---|---|
| `base` | l'instantané du banc UI (compte de test, lecture seule) : accueil, fiches, séries, saisons, épisodes, casting, similaires, sagas ; Vigie éteint |
| `vigie.on` | le faux Vigie du banc des demandes (`../../../live-requests`) : contrat `titles` complet (`access`, `mine`, `state`, `seasons`, `gaps`, `search`), chaque `POST titles/request` JOURNALISÉ, jamais relayé |
| `library.large` | les 1 200 films du banc des bibliothèques dans « Films » (`db4c1708cbb5dd1676284a40f2950aba`), ses genres |
| `search` | `/api/search` (la réponse « Orgueil » de l'instantané), découverte, épisodes, Parcourir (`/api/search/person|genre|studio`) |
| `fail.item:<id>` | la fiche `<id>` répond 500 |
| `slow.item:<id>:<ms>` | la fiche `<id>` répond après `<ms>` |
| `favorites.empty` | Favoris vide |
| `unpaired` | aucune session : santé du serveur, `pair/device/generate|status` (code en attente), vérification du serveur saisi, connexion refusée (401) |
| `trailer.unavailable` | la résolution de la bande-annonce échoue |

Identifiants de l'instantané employés :

| Titre | Identifiant | Pourquoi |
|---|---|---|
| Avatar Aang, le dernier maître de l'air (film) | `8691fdd93af7c11da75013ecc6a67ac0` | bande-annonce, saga, similaires |
| L'Attaque des titans : La dernière attaque (film) | `f461dd313e49d9bde1d226d22fe4ed08` | saga aux volets absents (Vigie) |
| Les Évadés (film) | `fcfbd7a81518be2f40de85b0d1ccd46f` | bandes-annonces, casting, similaires, pas de saga |
| Les Kassos (série, 8 saisons) | `29ee5c86d39a9e0dc425acfa34609fa1` | un épisode « À suivre » : l'ancre des épisodes |
| Cauchemar en cuisine (série, 15 saisons) | `cb8aef1fd75cb53ac7aa4fe86fa25453` | sa saison 1, épisode 1 : `425337b52d897ae647dcba206585d35f` |
| One Piece (série, 15 saisons) | `1e98cd83a1295aeb9336e87a46afe1d6` | longue bande de saisons |
| GTO (série, 1 saison) | `52665ab1c968caf9c32b3ef48f69b3f0` | saisons manquantes en onglets grisés (Vigie) |
| Films (bibliothèque) | `db4c1708cbb5dd1676284a40f2950aba` | grille, filtres |

Jamais un vrai compte ni un vrai Vigie : le faux backend seulement. Aucune
note posée, aucune demande relayée, aucun déjumelage exécuté (le double appui
s'arme puis se désarme), aucun identifiant réel tapé au jumelage.

## Fichiers et couverture

| Fichier | Écran | Règles |
|---|---|---|
| `fiche.json` | la fiche | FI-1 à FI-13, PA-5 |
| `recherche.json` | la recherche | RE-1 à RE-12 |
| `parcourir.json` | Parcourir | PA-1 à PA-4 |
| `bibliotheque.json` | bibliothèque et grilles | BI-1 à BI-12, GR-1 à GR-5 |
| `collections.json` | Ma liste et Favoris | CO-1, CO-2 |
| `reglages.json` | réglages | RG-1 à RG-12 |
| `jumelage.json` | jumelage | JU-1 à JU-7 |
| `bande-annonce.json` | bande-annonce | BA-1 à BA-4 |
| `vigie.json` | « demander » hors feuilles | VI-1 à VI-4, FI-9 |

Hors banc (un appui ne sait pas les montrer) : le glisser du pavé, la dictée,
le clavier système sur l'appareil — passage sur l'Apple TV « Chambre ».
