# Vos statistiques de visionnage

La page « Vos statistiques » (`/stats` sur le web, le bureau et le miroir ;
écran `stats` sur le mobile) montre à chacun ce qu'il a regardé, quand,
comment, et ce que ses recommandations ont appris de lui. Pas de TV, pas de
webOS (`Stats = Unavailable` dans `lazyPagesTv.tsx`).

## Le contrat : `GET /api/stats/me`

`?period=30d|year|all&tz=<IANA>&lang=fr|en[&refresh=1]` — les statistiques du
compte APPELANT, jamais d'un autre : l'identifiant vient du jeton, aucun
paramètre ne le désigne. Le contrat canonique est
`packages/shared/src/types/viewingStats.ts`, recopié octet pour octet dans
`apps/backend/src/services/viewingStats/contract.ts` (verrou :
`contractMirror.test.ts`). On modifie shared, puis :

```bash
cp packages/shared/src/types/viewingStats.ts apps/backend/src/services/viewingStats/contract.ts
```

Réponses : 200 ; 401 sans jeton ; 503 sans Jellyfin configuré ; 502 si
Jellyfin ne répond pas. Un serveur plus ancien répond 404 : les clients
l'annoncent (« Serveur à mettre à jour ») plutôt que d'échouer.

## D'où viennent les chiffres

Trois natures, jamais mélangées sans le dire :

| Nature | Source | Sert à |
|---|---|---|
| **Mesuré** | `watch_segments` (le collecteur interroge `/Sessions` toutes les 15 s) | durées réelles, rythme jour × heure, écrans, records |
| **Estimé** | durée des titres marqués « vus » (`RunTimeTicks`), chacun compté UNE fois | le temps d'avant la première mesure |
| **Compté** | Jellyfin (`IsPlayed`) | films et épisodes vus — exacts |

Le **raccord** est celui du classement de visionnage (`leaderboard/`) : un titre
dont la dernière lecture précède la première mesure (l'« époque », tous comptes
confondus) ou n'a pas de date est estimé ; après, seule la mesure compte. Le
total « depuis le début » d'un compte est donc celui du classement.

Garde-fous :

- **Marquage en masse** : quatre titres ou plus « vus » dans la même minute
  n'ont pas de date fiable. Ils comptent dans « depuis le début », jamais dans
  une période datée ni dans la frise (`undatedSeconds`).
- **Plancher de bruit** : moins d'une minute ne fait ni un genre, ni une
  langue, ni un visage, ni un appareil, ni une série — une lecture d'essai de
  2 s n'apparaît nulle part.
- **Fuseau** : jours et heures sont ceux de l'APPAREIL (`tz`, lu par
  `deviceTimeZone()`), calculés par tranches de 15 minutes UTC — tout décalage
  du monde en est un multiple, changements d'heure compris.
- **Visionnages d'un film** : 1 dès qu'il est marqué « vu », et autant que de
  jours distincts où la mesure l'a vu à 60 % ou plus. `PlayCount` compte les
  reprises, pas les visionnages : il ne sert pas.
- **Tout se juge à la durée**, jamais au nombre d'épisodes : le marathon est
  le plus de TEMPS sur une série en un jour (deux épisodes et une heure au
  moins), une série de jours exige un quart d'heure par jour, le trait
  « Marathonien » trois heures d'une même série. Vingt épisodes de trois
  minutes ne font pas un marathon.

Genres, pays d'origine, langue originale, décennies, acteurs et réalisation
viennent des fiches TMDB **déjà en cache** (`tmdb_meta_cache`, aucun appel
TMDB — périmées pour le moteur comprises : ces faits ne changent pas), pour les
250 titres qui pèsent le plus ; au-delà, les genres Jellyfin rapprochés des ids
TMDB (`genreNames.ts` — une étiquette AniDB comme « super power » n'est pas un
genre). Un titre compte dans chacun de ses genres : les parts ne somment pas à
100 %, et la page le dit.

## Deux notions de langue, jamais confondues

Jusqu'à septembre 2026, la page pesait la langue ORIGINALE des titres par le
temps passé : « 65 % en anglais » à quelqu'un qui regarde tout en VF (un film
américain vu en VF comptait « anglais », « Dark » comptait « allemand »). Ce
chiffre a disparu (`languages` reste dans la réponse, toujours vide, pour les
anciens clients). À la place :

| Carte | Ce qu'elle dit | Source |
|---|---|---|
| **Origine des titres** | le pays où le titre a été produit (premier `origin_country` TMDB), pondéré par le temps ; pays + autres + « origine inconnue » = 100 % | fiches TMDB |
| **VF ou VO ?** | la piste audio LUE : VO (langue originale du titre), VF (doublage dans la langue de l'interface), autres doublages, puis les langues entendues | `watch_segments.audioLang` |

La piste lue est relevée par le collecteur (`watchTime/audioLanguage.ts`) :
`/Sessions` joint à l'élément en lecture les flux de sa source
(`NowPlayingItem.MediaStreams`) et l'index de la piste choisie
(`PlayState.AudioStreamIndex`). Sans index rapporté, une piste unique se lit ;
à plusieurs, on ne devine pas. Les séances d'avant le relevé n'en disent rien
et rien n'est déduit pour elles : la carte dit depuis quand elle mesure et sur
combien d'heures, et ne montre AUCUNE part sous 3 h et 5 séances relevées
dans la période (un mot d'attente à la place). VF/VO compare la piste à la
langue originale de la fiche TMDB : une séance sans fiche sort de cette base,
dite elle aussi.

## Les classements

- **Films préférés** (`movieRanking.ts`) : votre note (10/10 : +10 … 5/10 : 0
  … 1/10 : −8), coup de cœur (+6), « J'aime » (+3), « Pas pour moi » (−6),
  favori (+4), revisionnages (+2 par visionnage au-delà du premier, +6 au
  plus) ; le temps passé départage. Le premier est mis en avant s'il a une
  bonne note, un avis positif ou un revisionnage ; sans aucun avis, la page
  dit qu'elle classe au temps. Ma liste n'y entre pas : ce n'est pas un avis.
- **Séries** : au temps passé sur la période.
- **Visages** : d'abord le nombre de TITRES distincts où la personne figure
  (une série de quinze saisons compte pour un), puis le temps passé ; un
  titre ne compte que vu, ou regardé une minute au moins.

« Ce que vous aimez » lit le profil du moteur de recommandations TEL QUEL
(`taste_profiles.anchors` : les titres au poids positif, sauf l'envie seule),
avec les notes, coups de cœur, favoris. Aucun recalcul, aucune reconstruction
déclenchée d'ici.

« À voir » : les titres seulement dans Ma liste, ni vus ni aimés
(`taste_profiles.potentials`, cf. `reco/potentials.ts`). Une tuile à part —
le compte, quelques affiches, le chemin vers Ma liste — et jamais un
pourcentage : un potentiel n'est pas un avis, il ne pèse sur aucune autre
statistique de la page.

## Coût

Un calcul (170 à 300 ms mesurés sur les comptes de test) lit tout une fois,
produit les TROIS périodes, puis abandonne ses données brutes : seul le résumé
(~12 Ko par période) reste en mémoire, 10 minutes, 30 comptes au plus. Changer
de période ne relance rien. « Tirer pour rafraîchir » recalcule au plus une
fois toutes les 30 s. Parcours Jellyfin paginés (500), champs réduits, images
coupées ; les étiquettes d'images ne sont demandées que pour les titres
affichés.

## Les clients

- Web / bureau / miroir : `apps/web/src/pages/Stats.tsx` et
  `components/stats/`. Graphiques en SVG maison (pas de bibliothèque), règles
  du skill dataviz : UNE teinte de données, la marque (barres, grille), le
  neutre pour « autres » et « inconnue » ; l'estimé de la frise est la même
  teinte à 55 % (relation ordinale, validée par script en sombre et en clair).
  Aucune image en en-tête : la page gardait la teinte de l'affiche du titre le
  plus regardé. Entrées : menu utilisateur (en tête), profil Electron étroit,
  profil du miroir.
- Mobile : `apps/mobile/src/screens/StatsScreen.tsx` et `components/stats/`
  (react-native-svg). Entrée : en tête du Profil.
- Partagé : `useViewingStats` (api-client, qui remet la réponse d'un serveur
  plus ancien à la forme du contrat — `withViewingStatsDefaults`), mises en
  forme (`createStatsFormatter`), lecture du rythme, profil de spectateur
  (`viewerBadges` — à la durée ; polyglotte sur les langues ENTENDUES,
  globe-trotteur sur les pays), avis d'un titre et états de « VF ou VO ? »
  (`titleReasons.ts`) — `packages/shared/src/viewingStats/`.

## Partager ses statistiques : une page publique

« Partager » (web, bureau, miroir : panneau ; mobile : feuille) crée un lien
vers une page PUBLIQUE, ouverte sans compte : `/share/:token`, la même adresse
et la même coquille que Ma liste et Favoris. Aucune lecture n'y est possible :
ni bouton Lire, ni flux, ni jeton Jellyfin ; un titre ouvre au plus sa fiche
publique (`/share/:token/:itemId`, « Se connecter pour regarder »).

**Le lien** — `share_links`, kind `stats`, un par compte, révocable (révoquer =
supprimer : 404 ensuite, et un nouveau lien a un nouveau jeton). La colonne
`options` (JSON) garde la PÉRIODE choisie par le propriétaire et le FUSEAU de
son appareil : le visiteur voit ses jours à lui, le fuseau ne sort jamais du
serveur. Changer la période garde le jeton. Routes : `POST /api/share/stats`
(`{ period, tz }`), `GET /api/share/stats/mine`, `DELETE /api/share/stats`.
Sans la colonne (base d'avant core-init.sql), elles répondent 503 « base à
mettre à jour » ; les listes, qui ne la lisent jamais, continuent de marcher.

**La réponse publique** — `GET /api/share/:token?lang=` : une LISTE BLANCHE,
`PublicViewingStats` (`packages/shared/src/types/viewingStatsShare.ts`, miroir
backend `contractShare.ts`), construite champ par champ par
`publicProjection.ts` — jamais une copie rognée de la réponse du propriétaire.
Son test tient la forme exacte : un champ de plus doit être décidé.

| Public | Reste au serveur |
|---|---|
| temps, films, épisodes, séries, jours ; profil de spectateur (traits compris) | la grille jour × heure (heures précises) |
| activité ; « À quel moment ? » (4 moments de la journée + week-end, `habits.ts`) | écrans et applications |
| genres, formats, décennies, origines, VF ou VO | le fuseau du propriétaire |
| films préférés, séries, visages, avec ses notes et avis | la date de dernière lecture de chaque titre |
| records, **datés au mois** ; instants au jour (midi UTC) | « À voir » (Ma liste) et la date du profil de goût |
| ce qu'il aime (titres du goût, avis comptés) | |

Les traits « Oiseau de nuit », « Lève-tôt », « Spectateur du week-end » se
lisent sur les habitudes seules (`habitsInsight`) : mêmes parts, mêmes traits
que sur la page du propriétaire (`analyzeRhythm` lit ses parts dans
`habits.ts`, que le backend recopie). « VF ou VO ? » se mesure par rapport à
la langue du VISITEUR, comme les étiquettes : identique au propriétaire dans le
cas courant, et « Langues entendues » lève l'ambiguïté sinon.

**Sûreté** — le jeton (8 octets aléatoires) désigne le propriétaire, aucun
paramètre ne le peut ; un visiteur ne force jamais de recalcul (le cache de dix
minutes du propriétaire sert) ; les routes publiques ont leur plafond (60 par
minute et par adresse) et répondent `no-store` ; les pages `/share/*` portent
`X-Robots-Tag: noindex, nofollow`. Réponse légère : ~11 Ko, ~3 Ko compressés.

**Les clients** — la page publique réutilise les cartes de « Vos statistiques »
dans une VOIX publique (`components/stats/statsVoice.ts`) : l'espace de textes
`statsPublic`, à la troisième personne, est lu avant `stats` (react-i18next en
`nsMode: "fallback"`), le nom du propriétaire posé sur chaque texte, les titres
vers leur fiche publique, les visages sans lien. Le panneau du propriétaire
(`share/stats/`) et la feuille mobile (`components/stats/ShareStatsSheet.tsx`)
disent ce qui devient public et ce qui reste privé AVANT le moindre lien, et
chaque résultat au plus près du geste (un toast passerait sous la modale).

## Pièges connus

- **Hermes n'a ni `Intl.PluralRules`, ni `DisplayNames`, ni
  `RelativeTimeFormat`** (sondé sur le simulateur ; `DateTimeFormat` et le
  fuseau existent). i18next y retombe sur « 1 = singulier » : `heroFigure`
  rend un nombre de pluriel déjà tranché (« 1,7 heure » partout), et les noms
  de langues sont calculés par le SERVEUR.
- Aucun mot « téléchargement » dans l'espace `stats` (lu par le mobile) :
  `statsVocabulary.test.ts` le garde.
- Chrome sans tête : un viewport très haut fige `Page.captureScreenshot` —
  capturer par tranches en faisant défiler.
