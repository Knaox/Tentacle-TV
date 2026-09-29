# Section « Affiner » — la pile de swipe

Une pile de films et de séries à juger d'un geste — **j'aime**, **coup de cœur**
(super like), **pas pour moi** (dislike) — ou à **passer** sans juger, avec
**annulation** du dernier geste. Chaque verdict nourrit le moteur de
recommandations, et un **j'aime** (ou un coup de cœur) EST le cœur de la
bibliothèque : posé tout de suite si le titre est là, à son arrivée sinon.

## Où elle vit

Ce n'est plus une destination à part : c'est une **section de la page
Recommandations**, sous un segment « Pour vous · Affiner » en tête de page, et
une carte « Affinez vos recommandations » glissée après la deuxième rangée.
Aucune entrée dans la barre du bureau, les onglets du miroir, la barre basse
du mobile ni le rail de l'iPad.

| Client | Adresse | Détail |
|--------|---------|--------|
| Web, bureau, miroir | `/recommendations/refine` | `RecoSectionSwitch` + `SwipeSection` ; `/swipe` redirige ici |
| Mobile, tablette | onglet `for-you`, `?section=refine` | `useRecoSection` + `SegmentedChoice` ; `app/swipe.tsx` redirige ici |

Seule la section choisie est montée : le clavier de la pile (← → ↑ ↓ Z) ne
s'écoute que quand on la voit.

## Les gestes

| Geste | Web / bureau | Mobile |
|-------|--------------|--------|
| j'aime | glisser à droite · → · bouton ♥ | glisser à droite · bouton |
| coup de cœur | glisser vers le haut · ↑ · bouton ★ | glisser vers le haut · bouton |
| pas pour moi | glisser à gauche · ← · bouton ✕ | glisser à gauche · bouton |
| passer | glisser vers le bas · ↓ · bouton ⏭ | glisser vers le bas · bouton |
| annuler | Z · Ctrl/⌘+Z · Retour arrière · bouton | bouton |
| synopsis | clic sur la carte · Espace · I · bouton ⓘ | toucher la carte |

La lecture du geste est la même sur le web et le mobile
(`packages/api-client/src/swipe/swipeGesture.ts`) : l'axe qui **domine**
décide — horizontal → j'aime / pas pour moi, vertical → coup de cœur /
passer — pourvu qu'on aille assez loin (110 px) ou qu'on lance assez vite
(650 px/s, après 20 px au moins dans cette direction : un appui qui tressaille
ne juge rien). Le bas vaut « passer », comme le bouton : le verdict sans poids,
annulable d'un geste. Un tampon par direction (`stampStrength`) : un seul
s'allume, celui de l'axe qui domine, **plein au seuil** — ce qu'il annonce est
ce que le lâcher décidera.
VoiceOver : balayer vers le haut / le bas sur la carte propose les verdicts.

### Le changement de carte

- **La carte jugée garde le dessus** jusqu'au bout de sa sortie :
  l'empilement suit l'ordre d'arrivée des cartes (`swipeStackZ`), jamais leur
  place dans la liste rendue. Sur le web, AnimatePresence réinsère la carte qui
  part AVANT la nouvelle carte du dessus : à z-index égal, elle passait
  dessous, et la pile « tremblait » (la suivante surgissait à 95 %, puis
  regrossissait).
- **C'est la même carte qui part** (mobile : même vue, par clé ; web :
  AnimatePresence) — une copie remontait son affiche depuis le vide et
  perdait son tampon. Elle part du point de lâcher, garde l'autre axe
  (`exitTarget`), son verso et son tampon ; sa sortie se fige au premier
  calcul (deux verdicts rapprochés ne la font pas changer de cap).
- **La suivante monte déjà habillée** : son verso (titre localisé, durée) est
  chargé et posé dès qu'elle attend, la place du bouton ⓘ est réservée sur
  toutes les cartes — aucun texte ne se recompose sous les yeux.
- **Annuler en pleine sortie** ramène la carte à sa place (le web la laissait
  accrochée au bord : `x` manquait à la cible `animate`).
- Web : l'opacité passe par une MotionValue à nous (fil principal) — en WAAPI,
  la fin d'animation rendait une image l'ancien style (éclair).
- **Mouvement réduit** : fondu enchaîné sur place, ni envol ni zoom ; une carte
  lâchée avant le seuil revient en 150 ms, sans rebond. Mobile : Reanimated
  lit le réglage système au lancement et saute par défaut toute animation —
  ces versions réduites sont en `ReduceMotion.Never`.
- En dev, le mode strict de React 19 rejoue les effets d'un nœud DÉPLACÉ
  (framer-motion y perd ses animations) : la pile web est rendue dans l'ordre
  naturel, aucune carte n'est déplacée d'un rendu à l'autre.

## Ce qui part du serveur

`GET /api/swipe/deck?lang=fr|en&limit=20&exclude=movie:1,tv:2`
compose la pile (`services/swipe/deckService.ts`) :

| Part | Source | Sans clé TMDB |
|------|--------|---------------|
| 5/10 « goût » | le haut du pool classé du compte (150 premiers) | idem (pool bibliothèque) |
| 3/10 « populaire » | tendances TMDB de la semaine (films + séries, 2 pages) | les mieux notés de la bibliothèque |
| 2/10 « exploration » | le fond du pool, une page tirée au hasard des « mieux notés » TMDB, la bibliothèque au hasard | le fond du pool, la bibliothèque au hasard |

La pile alterne **bibliothèque / hors bibliothèque** (équilibre place par place)
quand TMDB est configuré. Rien de ce que le compte connaît déjà n'y entre : vu,
noté, favori, Ma liste, série entamée, « ne plus proposer », like Vigie, et
surtout **aucun titre déjà jugé**. Un « passé » revient après **30 jours**.

TMDB n'est appelé que par le backend (clé du serveur) ; le client ne reçoit que
des chemins d'affiches publics. Sans clé, la réponse porte
`tmdbConfigured: false` et l'interface l'annonce (« Votre bibliothèque
seulement »). Le moteur ne dépend pas de Vigie.

`POST /api/swipe` `{ mediaType: "movie"|"tv", tmdbId, verdict }` pose (ou
remplace) un verdict ; `DELETE /api/swipe/:mediaType/:tmdbId` l'annule ;
`GET /api/swipe/details/:mediaType/:tmdbId?lang&itemId` donne le verso
(synopsis, durée, saisons) — Jellyfin en bibliothèque (droits du compte),
TMDB sinon.

## Le j'aime est le cœur de la bibliothèque

Un like ou un coup de cœur pose le **cœur** du titre (`IsFavorite` Jellyfin),
pour le compte, à la clé admin (`services/swipe/swipeFavorites.ts`) :

| Le titre… | Ce qui se passe |
|-----------|-----------------|
| est dans la bibliothèque | cœur posé tout de suite ; l'index de la reco est retouché ; évènement WS `favorites` |
| n'y est pas (ou Jellyfin est muet) | drapeau `favorite` dans `watchlist_pending` — posé à son **arrivée** (diff de `libraryAddedNotifier`) ou au **balayage** (30 min), comme « Ma liste à l'arrivée » |
| avait déjà son cœur | rien |

Annuler le verdict — ou le remplacer par un refus, un « passer » — défait ce
que le like a posé, et rien d'autre : le cœur mis de côté, ou celui que CE
like a mis (mémorisé 24 h, le temps que la pile reste annulable) ; un cœur
d'avant le like reste. `saveSwipe` / `deleteSwipe` rendent le verdict d'avant
pour ça. L'affinité Watch Together n'y passe jamais.

**Rattrapage** : les likes donnés avant cette règle (bureau 1.24.0) reçoivent
leur cœur UNE fois par serveur, au démarrage (`swipeFavoritesBackfill.ts`,
marque `swipe_likes_favorited_at` dans `server_config`). Sur une base de dev
partagée avec de vrais comptes, poser la marque à la main AVANT de démarrer
le nouveau code — le rattrapage écrirait dans leurs favoris Jellyfin.

## Le poids dans le moteur

Les verdicts deviennent des **ancres du goût** (`services/reco/anchors.ts`,
poids dans `anchorSignals.ts`), au même titre que les notes et les favoris :

| Verdict | Poids d'ancre | Pour comparer |
|---------|---------------|---------------|
| coup de cœur | **+1,2** | favori +0,8 · like Vigie +0,7 (un même « j'aime » ne compte qu'une fois : le plus fort) |
| j'aime | **+0,7** | |
| pas pour moi | **−0,6** | « pas intéressé » −0,6 · abandon −0,6 |
| passer | 0 (aucune ancre) | |

Décroissance « explicite » (demi-vie 2 ans, plancher 60 %). Conséquences :

- un j'aime / coup de cœur devient **graine** (recommandations TMDB, rangées
  « Parce que vous avez aimé… ») — le coup de cœur passe devant ;
- un dislike **sort le titre** de toutes les rangées et pénalise ses voisins
  (genres, mots-clés, univers) par la composante « ressemblance aux refus » du
  classement — bornée à 0,25 du score, et proportionnée à la ressemblance :
  partager un genre coûte moins que ressembler vraiment ;
- les facettes d'un titre refusé deviennent négatives dans le profil moyen.

Tests qui le garantissent : `services/reco/swipeWeight.test.ts` (du verdict au
score d'un candidat, par les vraies fonctions), `services/swipe/*.test.ts`
(pile, exclusions), `services/reco/jobsSwipePoke.test.ts` (délai).

Un verdict relance le profil (débouncé, 8 s) ; le pool — donc « Pour vous » —
se régénère ensuite si son âge dépasse **3 minutes** (30 pour les autres
signaux) : une séance coûte une seule génération.

## Appliquer le schéma

Table `user_swipes` (modèle `UserSwipe`). **Jamais `prisma db push`** : il
supprimerait les tables du plugin Seer.

- **Production (Docker, MariaDB)** : rien à faire — `docker-entrypoint.sh`
  rejoue `prisma/core-init.sql` au démarrage, et le `CREATE TABLE IF NOT
  EXISTS` y figure.
- **Poste local (MySQL 9.6)** : `core-init.sql` entier échoue sur MySQL
  (`ADD COLUMN IF NOT EXISTS`). Rejouer ce seul bloc, depuis `apps/backend` :

```bash
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
CREATE TABLE IF NOT EXISTS `user_swipes` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `mediaType` varchar(10) NOT NULL,
  `tmdbId` int(11) NOT NULL,
  `verdict` varchar(12) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_swipes_jellyfinUserId_mediaType_tmdbId_key` (`jellyfinUserId`, `mediaType`, `tmdbId`),
  KEY `user_swipes_jellyfinUserId_updatedAt_idx` (`jellyfinUserId`, `updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL
pnpm db:generate
```

Si le moteur de reco n'a jamais tourné sur la base, vérifier aussi
`taste_profiles.anchors` (colonne des ancres, ajoutée par un chantier
précédent) : `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE
TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'taste_profiles' AND COLUMN_NAME =
'anchors'` — à 0, `ALTER TABLE taste_profiles ADD COLUMN anchors mediumtext NULL`.

**Le cœur en attente et les potentiels** (le like qui attend son titre,
cf. plus haut ; les titres seulement dans Ma liste, cf.
`docs/RECO-POUR-VOUS.md`) ajoutent deux changements, écrits dans
`core-init.sql` sous une forme **rejouable sur MariaDB comme sur MySQL**
(décision prise dans `information_schema`, `PREPARE`) : la colonne `flag` et
la clé primaire élargie de `watchlist_pending`, la colonne `potentials` de
`taste_profiles`. Sur le poste local, rejouer ces deux blocs tels quels
(extraits de `core-init.sql`, depuis « La table d'avant le drapeau » et
« Potentiels du goût ») par `npx prisma db execute --stdin`, puis
`pnpm db:generate`.
