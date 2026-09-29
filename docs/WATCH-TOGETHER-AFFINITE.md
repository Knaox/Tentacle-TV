# Watch Together — l'affinité, le swipe de groupe

Dans un groupe Watch Together, « Trouver quoi regarder » : on choisit **films**,
**séries** ou **animés**, et l'affinité s'ouvre chez TOUT le groupe. Chacun
swipe une pile COMMUNE — j'aime, pas pour moi, annuler —, et dès que tout le
monde aime le même titre, la proposition s'affiche chez tous en même temps :
« C'est un match ! », **Regarder ensemble** ou **Continuer à swiper**.

C'est un **mode partagé** : ce qu'un participant y décide vaut pour tous.

## Où elle vit

| Client | Entrée | Détail |
|--------|--------|--------|
| Web (bureau), app de bureau Electron | panneau Watch Together de la barre · modale du groupe | modale `watchTogether/affinity/`, même build pour les deux |
| Web en gabarit téléphone / tablette (miroir) | pilule « Affinité · … » | même code ; hors du périmètre éprouvé (bureau seulement, décision du 2026-09-29) |
| App mobile native, TV (Android TV, tvOS), webOS | — | Watch Together n'y existe pas (vues admin seulement ; webOS le neutralise par `shims/watchTogether.ts`) |

Seulement dans une salle d'**au moins deux membres** : seul, l'entrée reste
visible mais inactive et dit pourquoi ; le serveur refuse (`need_two_members`) ;
une séance s'arrête d'elle-même quand la salle passe sous deux membres.

## Le mode partagé

| Qui fait quoi | Chez les autres |
|---------------|-----------------|
| lance l'affinité (ou change de type) | elle s'ouvre, sur la pile, avec « X a lancé l'affinité · Films » — sauf devant un film : un toast, puis la pilule « Participer » |
| aime le titre que tous aimaient | « C'est un match ! » chez tous en même temps (la pile reste montée dessous) |
| « Continuer à swiper » | le match est **écarté** chez tous — il ne reviendra plus —, la pile reprend, avec « X continue de swiper : « Titre » est écarté » |
| « Regarder ensemble » | la séance se referme chez tous, la lecture part pour le groupe ; ceux qui swipaient suivent |
| « Quitter » (ou Échap) | à deux : la séance se referme chez l'autre aussi, avec « X a quitté l'affinité » ; à trois ou plus : les autres continuent, et le lisent |

La première réponse à un match vaut pour tous, et la vue le dit (« Le
premier qui répond décide pour vous deux »). Deux réponses croisées : la
seconde ne trouve plus rien (`answered` pour un lancement, sans effet pour un
écart) — personne ne part seul de son côté.

Ce que font les autres se dit **dans la modale** (`AffinityNotice`) : un toast
passerait sous son voile. Surimpression au-dessus des cartes, 4 s, sans rien
capter ; hors de la modale (quand elle vient de se fermer), un toast.

Un participant qui recharge la page retrouve sa pile ouverte ; une séance
refermée pendant une coupure ferme la pile au retour, et le dit.

## Les décisions

- **Trois gestes, rien de plus** (retour de l'utilisateur, 2026-09-29) :
  j'aime (droite, →), pas pour moi (gauche, ←), annuler (Z). Ni coup de
  cœur, ni « passer », ni verso. La pile d'« Affiner » en mode deux verdicts
  (`binary`) : la carte ne glisse qu'à l'horizontale.
- **Règle du match — l'unanimité des participants**, et ils sont au moins
  deux. *Participant* = membre qui swipe en ce moment (sa pile est ouverte).
  Quand le seul qui manquait quitte la séance ou le groupe, ce que les
  restants aimaient tous devient un match.
- **Groupe de plus de deux** : la même règle, étendue — la séance tourne tant
  qu'au moins deux participants swipent. Un départ ne la referme que s'il en
  laisse moins de deux ; à deux, quitter la referme donc chez l'autre.
- **Un match est une proposition** (`proposals`, la plus ancienne d'abord) :
  elle attend une réponse. Écartée ou lancée, elle est **tranchée** : ni
  reproposée, ni resservie. Tant qu'elle attend, seul le dédit de quelqu'un
  qui l'aimait (annuler, pas pour moi) la défait. Pas de liste de matchs :
  chaque match est lancé ou écarté.
- **Refermée, une séance garde ses votes** : relancer le même type la
  **reprend** là où l'on était (puce « Reprendre » sur le type) ; chaque type
  garde la sienne, par salle — passer des films aux séries puis revenir ne
  perd rien. Quitter le groupe emporte ses votes.
- **Le profil de goût n'est pas nourri.** Les votes de groupe restent en
  mémoire, avec la salle (comme le chat), et disparaissent avec elle — aucune
  table, aucune ancre. En sens inverse, le goût de chacun ORDONNE la pile
  commune, en lecture seule (ci-dessous).
- **Uniquement la bibliothèque.** La pile est l'intersection des
  bibliothèques des membres (droits Jellyfin compris), avec affiche, sauf ce
  que tous ont déjà vu. Jamais hors bibliothèque, jamais Vigie. Un membre
  arrivé après le lancement ne voit que ce qu'il peut lire.
- **Un type par séance**, choisi par n'importe quel membre ; le changer relance
  la pile pour tout le monde, après un avertissement — revenir au type d'avant
  le reprend. Films et séries s'entendent HORS animés ; « Animés » réunit
  films et séries d'animation japonaise, reconnus au genre « Anime » ou à un
  id AniDB/AniList, à l'univers animé du pool de reco, ou à la bibliothèque
  qui les range (nommée « Animés », « Anime »… — souvent le seul signe).

## L'ordre de la pile

Le goût commun : chaque membre donne à chaque titre une affinité de 0 à 1 —
coup de cœur d'Affiner 0,97 · Ma liste 0,95 · j'aime 0,9 · favori 0,85 · rang
dans son pool de reco 0,3→0,9 · série qu'il a entamée seul 0,3 · déjà vu 0,2 ·
refus d'Affiner 0,05 · inconnu 0,4. Le titre vaut la moyenne, **moins 0,35 ×
l'écart** entre le plus chaud et le plus froid (le consensus passe devant ce
qui clive), plus la note communautaire (0,05) et un hasard propre à la séance
(0,12). 400 titres au plus. `services/watchTogether/affinity/affinityRanking.ts`.

Tous voient le même ordre ; mais ce que d'AUTRES participants ont aimé et
qu'on n'a pas encore jugé passe devant, le plus aimé d'abord — c'est là qu'un
match attend. Rien ne le dit sur la carte.

## Lancer un match

« Regarder ensemble » prévient le serveur (`POST /affinity/launch`), qui
referme la séance chez tous ; puis on lance comme partout ailleurs : arriver
sur le lecteur d'un autre média le lance pour le groupe (`wt:setItem`). Une
série se lit à l'épisode à reprendre de celui qui lance ; terminée, sa fiche
s'ouvre. Qui swipait suit la lecture (fenêtre de suivi de 30 s, `wtEvents.ts`
→ `followsLaunch`) ; les autres ont la pilule « Lecture de groupe en cours ».

## Le contrat

REST, sous `/api/watch-together` (`routes/watchTogetherAffinity.ts`) :

| Route | Rôle | Refus |
|-------|------|-------|
| `GET /affinity` | la séance ouverte de ma salle, ou `null` (reprise) | — |
| `GET /affinity/kinds` | titres de chaque type que tout le groupe peut lire ; `resume` : les types qu'un lancement reprendrait | `not_in_group`, `need_two_members` |
| `POST /affinity` `{kind}` | lancer, reprendre, ou changer de type | + `empty_catalog` |
| `POST /affinity/join` `{limit}` | rejoindre ; rend les premières cartes | `no_session` |
| `POST /affinity/leave` | quitter (à deux : referme chez l'autre) | — |
| `GET /affinity/cards?sessionId&limit&exclude` | la suite de ma pile | `stale_session`, `not_participant` |
| `POST /affinity/votes` `{sessionId,key,verdict}` | `like` ou `dislike` ; rend `matched` et l'état | + `unknown_title` |
| `DELETE /affinity/votes/:key?sessionId` | annuler mon verdict | idem |
| `POST /affinity/dismiss` `{key}` | « Continuer à swiper » : écarté chez tous | `not_participant` |
| `POST /affinity/launch` `{key}` | « Regarder ensemble » : la séance se referme | + `answered` |

Socket : UN message, serveur → clients, `wt:affinity` `{ state, cause,
originUserId, matchKeys?, match? }` — l'état de la séance ouverte (type,
participants avec ce qu'ils ont jugé, matchs en attente), `null` quand elle se
referme ; hors `wt:state` et de son epoch. Causes : `start`, `switch`, `join`,
`quit`, `vote`, `match`, `unmatch`, `dismiss`, `launch`, `end`. `match` : le
match écarté, défait ou lancé. Additif : aucun `wt:*` existant ne bouge, un
client d'avant ignore le message. Contrat :
`packages/shared/src/types/watchTogetherAffinity.ts`, recopié tel quel dans le
backend (`protocolMirror.test.ts` tient les deux copies).

Aucun schéma Prisma. Un client récent face à un serveur d'avant : pas de
séance, et « Le serveur doit être mis à jour » au choix du type — d'où
`minServer` à relever à la livraison.

## Vérifié

Tests : logique de séance (unanimité, propositions tranchées, dédits, départs,
reprise, pile servie), classement et types, catalogue de bout en bout (Jellyfin
simulé), routes (mode partagé à deux et à trois, réponses croisées, reprise,
changement de type, refus, verdicts retirés), pile client (réducteur),
messages du socket côté web (ouverture chez l'autre, messages, fermeture,
suivi du lancement, relecture après rechargement).

En vrai, le 2026-09-29, à deux comptes (Knaoxtest + Knaoxtest2, backend de
banc) : deux origines du navigateur intégré, puis l'app Electron (profil
jetable, pilotée par CDP) face au navigateur, dans les deux sens —
lancement ouvert chez l'autre avec son message ; match chez les deux ;
« Continuer à swiper » écarté chez les deux avec le message ; « Quitter » et
Échap refermant chez l'autre avec le message ; changement de type suivi ;
trois gestes seulement (↑, ↓, Espace et glisser vertical sans effet, glisser
horizontal qui juge) ; reprise d'une séance refermée, chaque type gardant la
sienne ; rechargement d'un participant ; « Regarder ensemble » lancé depuis
l'Electron (lecteur mpv) et suivi par le navigateur jusqu'au même épisode.
Non éprouvé en vrai : un groupe de trois (deux comptes de test seulement —
couvert par les tests de routes) et le gabarit téléphone (hors périmètre).
