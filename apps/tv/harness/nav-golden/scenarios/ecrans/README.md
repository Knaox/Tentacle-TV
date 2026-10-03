# Scénarios dorés — les écrans (T7)

La navigation PROPRE à chaque écran du chemin refondu d'Apple TV (relevé :
`docs/tv-navigation/ecrans.md`, dont ils citent les règles dans `rules`) :
fiche, recherche, Parcourir, grilles, bibliothèque, Ma liste et Favoris,
réglages, jumelage, bande-annonce, et les gestes « demander » de Vigie hors
feuilles. Enregistrés sur le SHA de référence **84f3cedd0**, rejoués en
`verify` après l'extraction : à l'identique.

## Format

Celui du banc, figé par T2 (`.claude/nav-lot/FORMAT-SCENARIOS.md`) : un
fichier par écran, à la racine de ce dossier, `{ domain: "ecrans", reference,
defaults, scenarios: [...] }`. Un scénario : `id` (unique dans le domaine,
préfixé par l'écran), `title`, `rules` (les règles du relevé couvertes),
`start` (`session` `paired` ou `none`, `fixtures`, `route` de départ), `steps`
(`do` : un geste de l'agent `atv-remote` ou une liste de gestes — `up` `down`
`left` `right` `select` `menu` `play`, `hold:<s>`, `holdup|holddown|holdleft|holdright:<s>`,
`wait:<s>`, `type:<texte>` avec `\n` pour la validation du clavier système ;
`settleMs` ; `expect` : `focus`, `label`, `route`, `panel`, `writes` ; `why`).

Chaque scénario attend, dans son approche (`start.keys`), que l'écran ait
fini de se charger avant le relevé de l'entrée — sauf les deux qui relèvent
justement le chargement (`fiche-lente`, `parcourir-lent`, sur une réponse de
15 s).

Les `expect` ne disent que ce que le code GARANTIT (le relevé) ; tout le
reste — clé focalisée, libellé, route et pile, Modal, écritures, après CHAQUE
geste — est relevé par `record` dans `<nom>.golden.json` (jamais écrit à la
main) et doit revenir à l'identique en `verify`. Un pas sans `expect` dont le
`why` dit « relevé » n'affirme rien : c'est la référence qui fait foi.

## Jeux de données

Ceux du banc : `base/vigie-off` (Vigie éteint), `base/demandes-on` (faux Vigie
qui accepte les demandes, chacune JOURNALISÉE, jamais relayée),
`base/bandes-annonces-en-panne` (bande-annonce indisponible). Ceux de ce
domaine (`fixtures.mjs`) :

| Jeu | Ce qu'il change |
|---|---|
| `ecrans/recherche` | sert Parcourir (filmographie d'une personne d'après les crédits de l'instantané, titres d'un genre, studio vide) et les épisodes de la recherche (aucun) — la base ne les a pas |
| `ecrans/parcourir-lent` | comme `ecrans/recherche`, la filmographie d'une personne répond après 15 s |
| `ecrans/fiche-en-erreur` | la fiche de « Les Évadés » répond 500 |
| `ecrans/fiche-lente` | la fiche de « Les Évadés » répond après 15 s |
| `ecrans/favoris-vides` | Favoris vide |
| `ecrans/grande-bibliotheque` | « Films » porte 1 200 titres (copies des films de l'instantané, identifiants neufs) |
| `ecrans/jumelage` | sans session : la connexion par identifiants est refusée (401) ; le serveur saisi est le faux backend `http://localhost:3107` |

Le code du RELAIS de jumelage n'est jamais affiché : il interrogerait le vrai
relais (https://pair.tentacletv.app). Sa règle (JU-1, la croix seule action)
est éprouvée par les tests de tv-core.

Identifiants de l'instantané employés :

| Titre | Identifiant | Pourquoi |
|---|---|---|
| Avatar Aang, le dernier maître de l'air (film) | `8691fdd93af7c11da75013ecc6a67ac0` | bande-annonce, saga, similaires |
| Grand Theft Auto VI : un large aperçu (film) | `c04c7103cb08371950ca5c68a534e05d` | la seule chaîne de similaires de l'instantané : son 12ᵉ similaire, Avatar, a les siens |
| L'Attaque des titans : La dernière attaque (film) | `f461dd313e49d9bde1d226d22fe4ed08` | saga aux volets absents (Vigie) |
| Les Évadés (film) | `fcfbd7a81518be2f40de85b0d1ccd46f` | bandes-annonces, casting, similaires, pas de saga |
| Orgueil et Préjugés (film) | `e86346a08c2bb2900795777307b0a32d` | son casting a les seules filmographies de l'instantané (Keira Knightley en tête) |
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
| `fiche.json` | la fiche | FI-1 à FI-8, FI-10, FI-11, FI-13, PA-5 |
| `recherche.json` | la recherche | RE-1 à RE-10 (RE-11 et RE-12 : tests unitaires) |
| `parcourir.json` | Parcourir | PA-1 à PA-4 |
| `bibliotheque.json` | bibliothèque et grilles | BI-1 à BI-3, BI-5 à BI-8, BI-10, BI-12, GR-1 à GR-4 (BI-4, BI-9, BI-11 : tests unitaires) |
| `collections.json` | Ma liste et Favoris | CO-1, CO-2 |
| `reglages.json` | réglages | RG-1 à RG-12 |
| `jumelage.json` | jumelage | JU-1 à JU-7 |
| `bande-annonce.json` | bande-annonce | BA-1, BA-3, BA-4 (BA-2, le chrome en lecture : test unitaire, aucune bande-annonce ne se lit au banc) |
| `vigie.json` | « demander » hors feuilles | VI-1, VI-2, FI-9, FI-10 |

Hors banc (un appui ne sait pas les montrer) : le glisser du pavé, la dictée,
le clavier système sur l'appareil — passage sur l'Apple TV « Chambre ».
