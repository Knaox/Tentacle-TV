# Watch Together — l'affinité, le swipe de groupe

Dans un groupe Watch Together, « Trouver quoi regarder » : on choisit **films**,
**séries** ou **animés**, chacun swipe de son côté une pile COMMUNE, et dès que
tout le monde aime le même titre, une proposition apparaît — « C'est un
match ! » — avec **Regarder ensemble**.

## Où elle vit

| Client | Entrée | Détail |
|--------|--------|--------|
| Web (bureau), app de bureau Electron | panneau Watch Together de la barre · modale du groupe | modale `watchTogether/affinity/`, même build pour les deux |
| Web en gabarit téléphone / tablette (miroir) | pilule « Affinité · … » | le miroir n'a pas de bouton Watch Together : la pilule y sert d'entrée ET de retour |
| App mobile native, TV (Android TV, tvOS), webOS | — | Watch Together n'y existe pas (vues admin seulement ; webOS le neutralise par `shims/watchTogether.ts`) |

Seulement dans une salle d'**au moins deux membres** : seul, l'entrée reste
visible mais inactive et dit pourquoi ; le serveur refuse (`need_two_members`) ;
une séance s'arrête d'elle-même quand la salle passe sous deux membres.

## Les décisions

- **Règle du match — l'unanimité des participants.** Un titre est un match
  quand TOUS les participants de la séance l'ont aimé (« j'aime » ou « coup de
  cœur »), et qu'ils sont au moins deux. *Participant* = membre qui a ouvert
  l'affinité ; fermer le panneau ne le retire pas (ses votes comptent), un
  membre qui ne l'a jamais ouverte ne bloque rien, « Ne plus participer » le
  retire. Un match est acquis : un nouvel arrivant ne le défait pas ; seul
  celui qui l'avait aimé le défait (annuler, ou changer d'avis). Quand le seul
  qui manquait quitte la séance ou le groupe, ce que les restants aimaient
  tous devient un match.
- **Le profil de goût n'est pas nourri.** Les votes de groupe restent en
  mémoire, avec la salle (comme le chat), et disparaissent avec elle — aucune
  table, aucune ancre. Un vote de groupe dit « d'accord pour ce soir, avec
  eux », pas « j'aime » : un refus parce qu'on l'a déjà vu, un oui pour faire
  plaisir fausseraient les recommandations, et « Affiner » écarte à vie un
  titre jugé. En sens inverse, le goût de chacun ORDONNE la pile commune, en
  lecture seule (ci-dessous).
- **Uniquement la bibliothèque.** La pile est l'intersection des
  bibliothèques des membres (droits Jellyfin compris), avec affiche, sauf ce
  que tous ont déjà vu. Jamais hors bibliothèque, jamais Vigie. Un membre
  arrivé après le lancement ne voit que ce qu'il peut lire.
- **Un type par séance**, choisi par n'importe quel membre ; le changer relance
  la pile pour tout le monde (votes remis à zéro, **matchs gardés**), après un
  avertissement. Films et séries s'entendent HORS animés ; « Animés » réunit
  films et séries d'animation japonaise, reconnus au genre « Anime » ou à un id
  AniDB/AniList, à l'univers animé du pool de reco, ou à la bibliothèque qui
  les range (nommée « Animés », « Anime »… — souvent le seul signe).

## L'ordre de la pile

Le goût commun : chaque membre donne à chaque titre une affinité de 0 à 1 —
coup de cœur d'Affiner 0,97 · Ma liste 0,95 · j'aime 0,9 · favori 0,85 · rang
dans son pool de reco 0,3→0,9 · série qu'il a entamée seul 0,3 · déjà vu 0,2 ·
refus d'Affiner 0,05 · inconnu 0,4. Le titre vaut la moyenne, **moins 0,35 ×
l'écart** entre le plus chaud et le plus froid (le consensus passe devant ce
qui clive), plus la note communautaire (0,05) et un hasard propre à la séance
(0,12). 400 titres au plus. `services/watchTogether/affinity/affinityRanking.ts`.

Tous voient le même ordre ; mais ce que d'AUTRES ont aimé et qu'on n'a pas
encore jugé passe devant, le plus aimé d'abord — c'est là qu'un match attend.
Rien ne le dit sur la carte. Un « passer » revient en fin de pile, une fois
qu'on demande à revoir les titres passés.

## Les gestes

La mécanique d'« Affiner » telle quelle : `SwipeStack`, `SwipeControls`,
`useSwipeKeyboard` (← → ↑ ↓ Z, Espace), le verso (synopsis) de
`/api/swipe/details`. Les corrections d'Affiner s'y appliquent d'office.

« Regarder ensemble » prévient la salle (`POST /affinity/launch`), puis lance
comme partout ailleurs : arriver sur le lecteur d'un autre média le lance pour
le groupe (`wt:setItem`). Une série se lit à l'épisode à reprendre de celui qui
lance ; terminée, sa fiche s'ouvre. Qui avait la modale ouverte suit la lecture
(fenêtre de suivi de 30 s, `wtEvents.ts` → `followsLaunch`) ; les autres ont
la pilule « Lecture de groupe en cours ». Un match n'interrompt jamais un film
en cours : un toast suffit.

## Le contrat

REST, sous `/api/watch-together` (`routes/watchTogetherAffinity.ts`) :

| Route | Rôle | Refus |
|-------|------|-------|
| `GET /affinity` | la séance de ma salle, ou `null` (reprise) | — |
| `GET /affinity/kinds` | titres de chaque type que tout le groupe peut lire | `not_in_group`, `need_two_members` |
| `POST /affinity` `{kind}` | lancer, ou changer de type | + `empty_catalog` |
| `POST /affinity/join` `{limit}` | rejoindre ; rend les premières cartes | `no_session` |
| `POST /affinity/leave` | ne plus participer | — |
| `GET /affinity/cards?sessionId&limit&exclude` | la suite de ma pile | `stale_session`, `not_participant` |
| `POST /affinity/votes` `{sessionId,key,verdict}` | un geste ; rend `matched` | + `unknown_title` |
| `DELETE /affinity/votes/:key?sessionId` | annuler mon geste | idem |
| `POST /affinity/launch` `{key}` | un match part en lecture | `unknown_title` |

Socket : UN message ajouté, serveur → clients, `wt:affinity` `{ state, cause,
originUserId, matchKeys? }` — l'état de la séance (type, participants avec ce
qu'ils ont jugé, matchs, dernier lancement), hors `wt:state` et de son epoch.
Additif : aucun `wt:*` existant ne bouge, un client d'avant ignore le message.
Contrat : `packages/shared/src/types/watchTogetherAffinity.ts`, recopié tel
quel dans le backend (`protocolMirror.test.ts` tient les deux copies).

Aucun schéma Prisma. Un client récent face à un serveur d'avant : pas de
séance, et un toast « Le serveur doit être mis à jour » au choix du type —
d'où `minServer` à relever à la livraison.

## Vérifié

Tests : logique de séance (règle du match, dédits, départs, pile servie),
classement et types (animés compris), catalogue de bout en bout (Jellyfin
simulé), routes (parcours à deux, refus, changement de type, arrêt), pile
client (réducteur), messages du socket côté web.

En vrai, à deux comptes (Knaoxtest + Knaoxtest2, backend de banc, deux
origines dans le navigateur intégré) : groupe, choix du type avec les comptes
réels (415 films, 84 séries, 96 animés communs), pile commune identique,
match des deux côtés, dédit puis re-match (coup de cœur), lancement suivi par
l'autre (premier lancement, puis lancement ultérieur par la fenêtre de suivi),
lecture synchronisée, changement de type, liste des matchs, « Ne plus
participer », arrêt à un membre, gabarit téléphone (pilule, pile, glisser),
thème clair. Non éprouvé dans l'app Electron elle-même : son profil de dev est
le profil RÉEL de l'utilisateur — même build web, même lancement.
