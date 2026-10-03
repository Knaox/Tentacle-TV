# Retour, rail et menus — relevé et contrat (T4)

Lot « Extraction de la navigation Apple TV » (nuit du 2026-10-03), tâche T4.
Source de vérité : l'Apple TV refaite au SHA de référence **84f3cedd0**
(`apps/tv`, chemin « redesign »). Ce document dit, comportement par
comportement, ce que font Retour (Menu), le rail et ses menus, la navigation
entre écrans et la sortie de l'application — avant toute extraction — puis
l'API commune que les autres tâches utilisent.

Légende : **[code]** lu dans le code au SHA de référence ; **[mesuré]** mesuré
au simulateur ou sur l'Apple TV par les chantiers d'avant (carnet
`docs/TV-REFONTE.md`). Les identifiants (R1, F2…) sont ceux des scénarios de
référence (`apps/tv/harness/nav-golden/scenarios/retour-rail/`).

## Périmètre

| Domaine | Fichiers (au SHA de référence) |
|---|---|
| Pile du Retour | `packages/tv-core/src/nav/backLayers.ts`, `apps/tv/src/redesignWiring/back/BackScope.tsx` |
| Couches d'un écran à rail | `redesignWiring/screen/useRailBackLayers.ts`, `RedesignScreen.tsx`, `useRedesignScreen.ts` |
| Croix Retour | `redesignWiring/focus/backFocus.tsx` (`useBackFocus`) |
| Rail : vue | `apps/tv/src/redesign/nav/*` (`NavRail`, `NavCapsule`, `NavList`, `NavItem`, `NavEntryMenu`, `NavLegend`, `NavScrollIndicator`, `NavTextMeasure`, `navFrame`, `navGeometry`, `navText`) |
| Rail : câblage | `redesignWiring/nav/*` (`useRailState`, `useRailArrange`, `useNavCatalog`, `useNavEntries`, `NavMenuModal`), `screen/RailBridges.tsx`, `screen/RailShortcuts.tsx` |
| Politique du rail (pure) | tv-core `nav/railPinning`, `railOrder`, `railColumn`, `railScroll`, `railSpec` |
| Demandes dans le rail | `redesignWiring/vigie/RequestsEntry.tsx`, `RequestsPanel.tsx`, `redesign/requests/RequestsPanelView.tsx` |
| Suite de fiches | tv-core `nav/detailChain.ts`, `apps/tv/src/navigation/detailPage.ts` (le branchement `useOpenDetail` est à T7) |
| Navigation entre écrans | `apps/tv/src/navigation/*` (`AppNavigator`, `railNavigate`, `routeRailKey`, `detailPage`, `types`) |
| Sortie de l'application | le chemin natif de Menu (ci-dessous) |

Hors périmètre, mais inscrits dans la même pile : le lecteur
(`usePlayerBackLayers`, T5), les panneaux et feuilles (T6), les écrans (T7).
Android TV (`TVNavChrome`, `TVSideRail`, BackHandler) et webOS : intouchés.
webOS importe `createRailPinningStore` / `createUseRailPinning` (tv-core
`nav/railPinning`) ; Android TV importe aussi `RAIL`, `expandedItemWidth`,
`railHintWidth`, `expandedItemsRightEdge` (`nav/railSpec`) : ces exports ne
changent ni de nom ni de comportement.

## 1. Le chemin natif d'un appui sur Menu (tvOS 26, RN-tvOS 0.80)

- **R0.1** [code] UIKit livre l'appui à l'élément FOCALISÉ ; la chaîne de
  répondeurs remonte. Menu n'arrive jamais au JS par `useTVRemote`.
- **R0.2** [code] Chaque écran de la pile est enveloppé par sa portée
  `BackScope` (posée par `screenLayout` autour de l'écran, de son
  `ErrorBoundary` et de son `Suspense`) : un `TVMenuPressInterceptor`
  (`ios/TentacleTV/TVMenuPressInterceptor.m`).
- **R0.3** [code] La décision est prise au DÉBUT de l'appui
  (`pressesBegan`) : `enabled` vrai → l'appui est pris, sinon il continue
  vers UIKit. Elle tient jusqu'à la fin de cet appui, même si `enabled`
  bascule entre-temps (`_menuPressTaken`).
- **R0.4** [code] L'action part au RELÂCHEMENT (`pressesEnded` →
  `onMenuPress`). Un appui annulé par le système (`pressesCancelled`) ne fait
  rien. Les autres touches d'un même lot suivent leur chemin.
- **R0.5** [code + mesuré] Menu ne dépile JAMAIS un écran de lui-même :
  `gestureEnabled: false` sur tous les écrans (Apple TV), et le patch de
  react-native-screens (`RNSNavigationController gestureRecognizerShouldBegin:`)
  refuse le geste Menu d'UIKit quand l'écran du dessus a `gestureEnabled:
  false` ou `preventNativeDismiss`. Sans preneur, l'appui monte à UIKit, qui
  QUITTE l'application — même avec plusieurs écrans empilés dessous (mesuré).
- **R0.6** [code] Une `Modal` vit dans son propre contrôleur : Menu y va à son
  `onRequestClose`, sans passer par la portée de l'écran.
- **R0.7** [code] Le rail de la refonte est rendu PAR la vue de chaque écran
  (prop `nav`) : il est DANS la portée, son Menu passe par l'intercepteur de
  l'écran. (Le rail d'Android TV, frère du navigateur, a le sien ; il ne se
  montre jamais sur Apple TV.)
- **R0.8** [code] Ce qui est monté HORS des écrans — bandeau hors ligne,
  jumelage expiré, messages de session (frères du navigateur dans `App.tsx`) —
  n'est sur le chemin d'aucune portée : Menu y QUITTE l'application, le focus
  étant dans le bandeau (règle d'App Review, voulue).

## 2. La pile des couches

- **R1.1** [code] Une couche = `{ kind, active, onBack }`, `kind` ∈ `menu`,
  `overlay`, `page`, `rail`. Ordre de consultation : **menu > overlay > page >
  rail** ; la première couche ACTIVE répond.
- **R1.2** [code] À rang égal, la plus récemment ACTIVÉE répond (un menu ouvert
  dans un panneau se ferme avant lui). Une couche déjà active qui se met à
  jour (nouveau gestionnaire) ne repasse pas devant.
- **R1.3** [code] Les couches se déclarent actives D'AVANCE : la portée dit à
  UIKit, avant l'appui, si elle le prendra (R0.3).
- **R1.4** [code] Résolution d'un appui pris par la portée : la couche visée
  répond ; aucune → la page POUSSÉE recule (`goBack`) ; sinon rien (cas
  théorique : une couche désactivée entre le début et la fin de l'appui —
  l'appui est alors avalé, l'app ne quitte pas).
- **R1.5** [code] `enabled` de la portée = « une couche active » OU « page
  poussée », avec poussée = route hors `RAIL_ROUTES` ET `canGoBack()`.
  `RAIL_ROUTES` = Home, Recommendations, Search, Watchlist, Favorites,
  Settings, Library.
- **R1.6** [code] Aucune couche active et page non poussée : l'appui n'est
  pas pris → UIKit quitte (X1).

### Qui inscrit quoi (au SHA de référence)

| Source | Couche | Active quand | Action | Tâche |
|---|---|---|---|---|
| `useRailBackLayers` (pages du rail) | page | focus hors du rail | ouvrir le rail sur l'entrée de la page | T4 |
| `useRailBackLayers` (pages du rail) | rail | focus dans le rail, pas sur le profil | focus sur le profil (`nav:Settings`) | T4 |
| `useRailBackLayers` (tout écran à rail) | menu | déplacement d'une entrée | annuler le déplacement | T4 |
| `useRailBackLayers` (tout écran à rail) | menu | menu d'une entrée ouvert | fermer le menu | T4 |
| `RequestsPanel` | menu | fenêtre ouverte, pas en sortie | jouer la sortie puis fermer | T4 |
| `SettingsRedesign` | menu | ligne soulevée (Réglages › Navigation) | annuler | T7 |
| `ChoiceModal` | menu | liste de choix ouverte | fermer | T7 |
| `PairingRedesign` | page | étape relayCode, manualServer, manualLogin, manualCode | étape précédente | T7 |
| `useLibrarySheets` | menu | liste de filtres ouverte | fermer, puis réclamer la pastille | T6/T7 |
| `ActionSheetRedesign` | menu | grand panneau, pas en sortie | sortie | T6 |
| `AbsentSheetRedesign` | menu | monté | sortie | T6 |
| `SeasonsSheetRedesign` | menu | pas en sortie | sortie | T6 |
| `usePlayerBackLayers` | menu ×3, overlay, page | état passager, Réglages, Épisodes ; habillage à l'écran ; toujours | voir T5 | T5 |

## 3. Retour, contexte par contexte

| # | Contexte | Retour (Menu) |
|---|---|---|
| R2.1 | Page du rail, focus dans le contenu | Le rail s'ouvre, focus sur l'entrée de la page (`nav:<railKey>`, sinon `nav:Home` si elle n'est pas montée). |
| R2.2 | Page du rail, focus sur une entrée du rail autre que le profil (y compris l'aperçu des demandes `nav:Requests`) | Focus sur le profil (`nav:Settings`), rail toujours ouvert, page inchangée. |
| R2.3 | Page du rail, focus sur le profil | Sortie de l'application (X1). |
| R2.4 | Réglages (page du rail dont l'entrée EST le profil), focus dans le contenu | Rail ouvert sur le profil → le Retour suivant QUITTE : deux appuis au lieu de trois. |
| R2.5 | Menu d'une entrée du rail ouvert (Modal) | Le menu s'efface (`FadingModal`) ; le focus revient à l'entrée dont il parlait (O2.6) ; le rail reste ouvert. |
| R2.6 | Déplacement d'une entrée en cours | Annulé : l'ordre d'avant, rien d'enregistré ; focus sur l'entrée à sa place (`claimAfterRestore`). |
| R2.7 | Fenêtre des demandes ouverte (Modal) | Sortie jouée, Modal retirée ; tvOS rend le focus à l'aperçu ; rail resté ouvert dessous. |
| R2.8 | Page POUSSÉE qui montre le rail (étagère personne / genre / studio : `SearchBrowse`) | Recule d'une page — rail ouvert ou non ; d'abord menu / déplacement s'il y en a. |
| R2.9 | Page poussée sans rail (fiche, bande-annonce, lecteur…) | Ses couches d'abord, puis recule ; focus rendu à la carte d'origine par l'écran révélé. |
| R2.10 | Suite de fiches | Un seul Retour ramène avant la PREMIÈRE fiche (D1). |
| R2.11 | Jumelage, étape intermédiaire | Étape précédente : code du relais ou serveur → accueil du jumelage ; identifiants → serveur ; code du serveur → identifiants. |
| R2.12 | Jumelage, accueil ou succès | Aucune couche ; jumelage à la racine (le seul chemin d'aujourd'hui, B1) → sortie. |
| R2.13 | Erreur d'un écran du rail (`RailScreenError`) | Même règle que la page du rail (elle a son `RedesignScreen`). |
| R2.14 | Erreur d'une page poussée (`PlainScreenError`) | Recule (page poussée). |
| R2.15 | Chargement d'un écran du rail (`RailSkeleton`) | Même cadre que la page du rail (rail, couches). |
| R2.16 | Bandeaux hors des écrans (hors ligne, jumelage expiré) | Sortie (R0.8). |
| R2.17 | Modales des autres tâches (grand panneau, filtres, choix, saisons, absent) | Elles se ferment, rien d'autre (leur `onRequestClose`). |

## 4. Navigation entre écrans

- **N1.1** [code] Route initiale : session (`tentacle_token`) → `Home`, sinon
  `PairCode` (Apple TV : jamais `Disclaimer`).
- **N1.2** [code] Pages du rail = ONGLETS (`railNavigate`) : la pile vaut
  `[Home]` ou `[Home, cible]` ; Accueil garde son instance (même clé de route),
  les autres repartent à neuf. Accueil choisi → `reset` à `[Home]`. Sans
  Accueil dans la pile, `[cible]` seule.
- **N1.3** [code] Transitions : pages du rail sans animation ; pages poussées
  en fondu de `TV_MOTION.page.fadeMs` (320 ms, Apple TV).
- **N1.4** [code] Jumelé → `replace("Home")` ; « Changer de serveur » /
  « Déconnexion » → `unpair` → `reset` à `[PairCode]`.
- **N2.1** [code] OK sur une entrée du rail (`useRailActions.onSelect`), dans
  cet ordre :
  1. un déplacement en cours → l'entrée est POSÉE (O3.3), rien d'autre ;
  2. « Tout afficher » → tout réapparaît, focus sur l'entrée active ;
  3. Rechercher → `returnToSearchBar()` : sur une étagère, recule vers la
     recherche ; sur la recherche, sa barre reprend le focus ; sinon, suite ;
  4. l'entrée de la page courante → `onReselect` (Parcourir : recule) sinon le
     focus revient au contenu (dernière cible encore montée, sinon l'entrée) ;
  5. une autre page → (Accueil seulement) le focus repasse D'ABORD dans le
     contenu dans le même geste (`focusNow`, N2.2), puis `railNavigate`.
     Bibliothèque : `Library_<id>`, son nom lu dans le cache des
     bibliothèques. Profil → `Settings` (onglet Compte).
- **N2.2** [code + mesuré] Quitter l'accueil par le rail : son instance reste
  montée sous la page choisie et UIKit lui rendrait le focus qu'elle avait —
  une entrée du rail, qui rouvrait le rail sur l'ANCIENNE page au retour. Le
  focus repasse donc dans son contenu avant de partir ; au retour sur
  l'accueil : rail replié, focus sur le contenu.
- **N2.3** [code] La page d'arrivée prend son entrée, rail replié
  (`useEntryFocus`, T3).

## 5. Le rail au focus : ouverture et repli

- **F1** [code] Le rail est OUVERT quand une clé `nav:*` a le focus (entrées,
  profil, aperçu des demandes, actions du menu d'une entrée `nav:menu:*`).
- **F2** [code] Un focus posé sur une clé de CONTENU le replie aussitôt.
- **F3** [code] Une clé `nav:*` qui perd le focus : 30 ms plus tard, si une
  autre clé de l'écran a le focus et qu'elle n'est pas `nav:*`, le rail se
  replie ; si AUCUNE clé de l'écran n'a le focus (il est dans une Modal à
  magasin propre : fenêtre des demandes), il reste ouvert (sinon replié puis
  redéplié à la fermeture, filmé).
- **F4** [code] Ouvert aussi tant qu'un menu d'entrée est ouvert ou qu'une
  entrée se déplace : `expanded = railFocused || heldKey || movingKey`.
- **F5** [code] Le dépliage : ressort `unfold` (réponse 0,36 s,
  amortissement 0,88), voile (préréglage `veil`) monté seulement rail ouvert ;
  libellés et bulle de légende gardés le temps du repli.
- **F6** [code] Légende (rail ouvert) : « ◀ Profil et réglages », « ⊙ Maintenir
  OK : organiser » ; pendant un déplacement : « ↕ Haut, bas : déplacer »,
  « ⊙ OK pose, Retour annule » (`nav:railProfile`, `railHintOrganize`,
  `railHintMove`, `railHintDrop`).

## 6. La colonne et son défilement

- **C1** [code] Colonne (`railColumn`, testé) : bloc des pages haut comme ses
  entrées, CENTRÉ sur 1080, jamais plus de 890 ; bloc du profil ancré en bas
  (marge `TV_STAGE.nav.bottom`), jamais caché ; écart de 14 ; c'est le bloc des
  pages qui cède (il remonte, puis rétrécit et défile). Accessoire au-dessus du
  profil : hauteur bornée à 240, écart 8.
- **C2** [code] Ordre des entrées : Rechercher (à part, en tête) ; Accueil ;
  les entrées organisables visibles dans l'ordre choisi (Pour vous, Ma liste,
  Favoris, chaque bibliothèque par défaut) ; « Tout afficher » si une entrée
  est masquée ; profil en bas.
- **C3** [code + mesuré] Au pavé, c'est tvOS qui fait défiler la liste native
  et tient l'entrée focalisée à 180 points des bords ; la liste ne laisse pas
  le focus en sortir avant son bout (flèche maintenue : arrêt sur la dernière
  entrée, jamais sur le profil).
- **C4** [code] La vue ne défile elle-même qu'au montage (clé figée du banc ?
  sinon entrée déplacée ? sinon entrée du menu ? sinon page courante), rail
  replié (l'entrée de la page courante, aussi quand la hauteur change) et
  menu d'une entrée ouvert (l'entrée dont il parle) — même marge
  (`railRevealOffset`, confort 180). Une demande de défilement est « en vol »
  450 ms ; partie avant la taille du contenu, elle est rejouée.
- **C5** [code] Fondu des bords : seulement du côté où il y a plus (décollé
  de plus d'un demi-pas), sur 104 points ; opacité du DESSIN, jamais un calque.
- **C6** [code] Largeur ouverte : l'intitulé le plus long mesuré hors écran
  (Inter gras / medium), borné 300–380 ; tant que rien n'est mesuré, 380.
  Repliée : 88. Géométrie publiée à l'écran (`onGeometry`).

## 7. Raccourcis et ponts (guides tvOS)

- **S1** [code] Contenu focalisé : une bande invisible à gauche du contenu
  (de 0 à `contentLeft − 20`, toute la hauteur) mène à l'entrée ACTIVE (sinon
  Accueil) — GAUCHE depuis n'importe où ouvre le rail sur la page.
- **S2** [code] Rail focalisé : une zone à droite du rail OUVERT (bord =
  gauche + largeur ouverte + 12) rend le focus à la dernière cible de contenu
  encore montée, sinon à l'entrée. Les deux ponts ne coexistent jamais.
- **S3** [code] Rail focalisé, hors menu et déplacement : HAUT depuis
  Rechercher → profil (la navigation boucle).
- **S4** [code] BAS depuis le profil → Rechercher.
- **S5** [code] BAS depuis la dernière entrée → profil (géométrie seule).
- **S6** [code + mesuré] GAUCHE depuis n'importe quelle entrée → profil, une
  fois le guide ARMÉ : 450 ms après l'arrivée dans le rail ; 1 100 ms si le
  contenu avait le focus moins de 350 ms avant (flèche maintenue : la Siri
  Remote n'émet pas la fin de l'appui). Mesuré : GAUCHE maintenu 1,2 s et 2 s
  depuis une rangée s'arrête sur « Accueil ».

## 8. Organiser le rail

- **O1.1** [code] Appui long sur une entrée ORGANISABLE (Pour vous, Ma liste,
  Favoris, `Library_*`), hors déplacement → son menu. Rechercher, Accueil,
  « Tout afficher », le profil : rien.
- **O1.2** [code] Le menu (`NavMenuModal`, Modal + `FadingModal`) : titre =
  libellé, légende « n sur N » (parmi les organisables visibles) ; lignes
  Déplacer, Monter (estompée en tête), Descendre (estompée en bas), Masquer,
  Tout afficher (si une entrée est masquée), Réglages de la navigation. tvOS y
  focalise la ligne du haut : « Déplacer ». Garde anti-clic fantôme sur les
  six actions (le menu s'ouvre sous un OK encore enfoncé). L'entrée porte le
  liseré (`held`), la liste la garde en vue (C4).
- **O2.1** [code] Monter / Descendre : enregistré tout de suite
  (`moveRailKey`, parmi les VISIBLES, les masquées restent en place) ; le
  menu RESTE ouvert (OK, OK, OK).
- **O2.2** [code] Masquer : enregistré, menu fermé ; la suivante prend la case
  et le focus.
- **O2.3** [code] Tout afficher : enregistré, menu fermé, focus rendu à
  l'entrée du menu (O2.6).
- **O2.4** [code] Réglages de la navigation : `Settings`, onglet Navigation.
- **O2.5** [code] Déplacer : menu fermé, l'entrée est SOULEVÉE (O3).
- **O2.6** [code] Menu fermé par Retour (ou après Tout afficher) : le premier
  focus que tvOS rend au rail (une clé `nav:*` hors `nav:menu:*`) dans les
  1 500 ms est redirigé vers l'entrée du menu si ce n'est pas elle (elle a pu
  changer de case : Monter, Descendre).
- **O3.1** [code] Pendant un déplacement, Rechercher, Accueil, « Tout
  afficher », le profil et l'aperçu des demandes sont INFOCALISABLES : HAUT /
  BAS restent dans la liste.
- **O3.2** [code] Le focus natif passe à la case voisine ; l'ordre EN COURS y
  amène l'entrée soulevée (rendu par position, sans réclamation). Rien n'est
  enregistré avant la pose.
- **O3.3** [code] OK → posée (enregistrée).
- **O3.4** [code] Le focus quitte le rail (vers le contenu) → posée là où
  elle est.
- **O3.5** [code] Retour → annulé (R2.6).
- **O3.6** [code] Écran démonté en plein déplacement → annulé, rien de
  verrouillé.
- **O4** [code] Réglages › Navigation : OK sur une ligne la soulève (pastilles
  « Affichée », « Tout afficher » et « Ordre par défaut » verrouillées) ;
  HAUT / BAS la déplacent ; OK sur elle la pose ; quitter les lignes (vers les
  onglets) la pose ; Retour annule, focus sur sa case de DÉPART. « Tout
  afficher » / « Ordre par défaut » : focus sur la première ligne.
- **O5** [code] Stockage : `tentacle_webos_rail` =
  `{ "masquees": [...] }`, plus `"order": [...]` seulement après un
  déplacement (forme d'avant à l'octet près). Champ `masquees` : nom
  français, JAMAIS renommé. Partagé avec la LG et Android TV (qui ignorent
  `order`).

## 9. La suite de fiches

- **D1** [code] (`detailMove`, testé) Depuis une page qui n'est pas une fiche :
  empiler. Même page : rien. La page juste DESSOUS : reculer. Un épisode ou une
  saison de la série / saison courante : empiler. Sinon : REMPLACER.
- **D2** [code] Une page de détail = `MediaDetail` (titre `itemId`) ou
  `SearchBrowse` d'une personne avec identifiant (`detailPageOf`).
- **D3** [code] Branché (T7) depuis les cartes de la fiche, le casting, la
  pastille de la série, « Plus d'infos » et le repli de « Lire » du grand
  panneau, les affiches de la page d'une personne. Ailleurs : empiler.

## 10. La croix Retour (`useBackFocus`)

- **K1** [code] Verrou d'ARRIVÉE : au premier rendu et à chaque nouvelle
  valeur d'`arrival` (étape d'un automate), la croix est infocalisable
  (`isTVSelectable: false`, liaison ET nœud), SAUF si elle est l'entrée.
- **K2** [code] Libérée au premier focus de n'importe quelle autre clé de
  l'écran (contenu ou navigation), ou quand l'entrée devient la croix.
- **K3** [code] HAUT depuis dessous : la bande pleine largeur (`barKey`) vise
  la croix — armée seulement croix libre ET focus hors navigation (`nav:*`) ;
  sinon aucune destination et `focusable: false`.
- **K4** [code] BAS depuis la croix : `nextFocusDown` vers la dernière cible
  de contenu encore montée, sinon l'entrée (jamais elle-même), recalculé à
  chaque focus de la croix.
- **K5** [code] OK sur la croix : l'action de l'écran (reculer d'une page,
  d'une étape). Utilisateurs : fiche, Parcourir, jumelage, erreurs d'écran.

## 11. Les demandes dans le rail (Vigie)

- **Q1** [code] Garde fermée (Vigie absent ou trop ancien, compte sans
  droit) : aucun accessoire, aucune place réservée, aucune requête.
- **Q2** [code] Garde ouverte : l'aperçu `nav:Requests` au-dessus du profil,
  toujours là ; verrouillé pendant un déplacement (O3.1). OK ouvre la fenêtre.
- **Q3** [code] La fenêtre (Modal, magasin de focus à elle) : la croix
  `requests:close` seule action, prend l'entrée (élément du haut), garde
  anti-clic fantôme ; lignes focalisables seulement au-delà de 4 (pour
  défiler) ; Retour ou croix → sortie jouée puis retrait (R2.7).

## 12. La sortie de l'application

- **X1** [code + mesuré] Seul UIKit sait quitter : l'appui Menu non pris
  (R1.6) fait passer l'application en ARRIÈRE-PLAN (écran d'accueil de tvOS),
  le processus vivant ; on y revient dans l'état laissé.
- **X2** [code] Chemins de sortie : profil focalisé sur une page du rail
  (R2.3) ; jumelage à la racine sur son accueil ou son succès (R2.12) ;
  bandeaux hors des écrans (R2.16) ; erreur sans route (`DetachedError`).

## 13. Les durées

| Durée | Valeur | Où |
|---|---|---|
| Repli du rail après la perte du focus d'une entrée | 30 ms | `useRailFocused` (`COLLAPSE_DELAY_MS`) |
| Focus rendu au rail après la fermeture du menu d'une entrée | ≤ 1 500 ms | `useRailArrange` (`RETURN_WITHIN_MS`) |
| Reprise d'un focus restauré par tvOS ailleurs | ≤ 900 ms | `claimAfterRestore` |
| Armement de GAUCHE → profil | 450 ms ; 1 100 ms en rafale | `RailShortcuts` |
| Rafale (contenu focalisé il y a moins de) | 350 ms | `RailShortcuts` (`STREAM_MS`) |
| Demande de défilement « en vol » | 450 ms | `NavList` (`IN_FLIGHT_MS`) |
| Réclamation du focus (tvOS) | 40 + 50 ms, relâche à +120 ms | `claimTvFocus` |
| Arrivée close par un focus du rail venu de l'utilisateur | > 600 ms | `useEntryFocus` (T3) |
| Dépliage | ressort 0,36 s / 0,88 | `TV_MOTION.spring.unfold` |
| Voile d'une surimpression | 240 ms entrée, 180 ms sortie | `TV_MOTION.overlay` |
| Fondu d'une page poussée | 320 ms | `TV_MOTION.page.fadeMs` |

## 14. Les clés

- Focus : `nav:Search`, `nav:Home`, `nav:Recommendations`, `nav:Watchlist`,
  `nav:Favorites`, `nav:Library_<id>`, `nav:RailShowAll`, `nav:Settings`
  (profil), `nav:Requests` (aperçu), `nav:menu:{move,up,down,hide,showAll,settings}` ;
  `requests:close`, `requests:row:<clé>` ; `settings:nav:<i>`,
  `settings:nav:<i>:visibility`, `settings:nav:showAll`,
  `settings:nav:resetOrder`.
- Stockage : `tentacle_webos_rail` (O5).

## 15. Bugs et écarts relevés — NON corrigés

- **B1** Carnet ≠ code : `docs/TV-REFONTE.md` (« Le Retour ») range « jumelage
  ouvert depuis les réglages » parmi les pages poussées (Retour → page
  précédente). Au SHA de référence, « Changer de serveur » appelle `unpair`,
  qui REMET la pile à `[PairCode]` : Menu sur l'accueil du jumelage quitte
  l'application. Aucun chemin n'empile le jumelage.
- **B2** (lu dans le code, à confirmer au banc) Deux Menu rapprochés sur le
  menu d'une entrée : le second arrive pendant le fondu de sortie
  (`onRequestClose` toujours branché) et rappelle `closeMenu` sans entrée
  tenue — la redirection O2.6 est effacée. Après Monter / Descendre, le focus
  reste sur la CASE au lieu de suivre l'entrée.
- **B3** (théorique) Un appui pris par la portée dont la seule couche se
  désactive avant le relâchement, sur une page non poussée : l'appui est
  avalé, ni action ni sortie (R1.4).
- **B4** Commentaires périmés, sans effet : `AppNavigator` (Player : « le Menu
  qu'un panneau ouvert doit consommer (usePreventRemove) »), `claimAfterRestore`
  (« la pile le réempile (usePreventRemove) »), en-tête de
  `TVMenuPressInterceptor.m` (« conteneur racine du rail latéral » : il est
  aussi la portée de chaque écran).

## 16. L'API commune du Retour (publiée pour T5, T6, T7)

Validée par le coordinateur. Les noms ci-dessous sont ceux qui seront livrés.

### tv-core `nav/backLayers` (pur, sans React)

```ts
export type BackLayerKind = "menu" | "overlay" | "page" | "rail";
export const BACK_LAYER_ORDER: readonly BackLayerKind[]; // menu > overlay > page > rail

/** Une couche DÉCLARÉE par une règle pure : son action est un nom, pas une fonction. */
export interface BackLayerSpec<A extends string = string> {
  id: string;
  kind: BackLayerKind;
  active: boolean;
  action: A;
}

/** Ce que fait Retour : une couche répond, la page recule, ou la plateforme quitte. */
export type BackResolution<A extends string = string> =
  | { kind: "layer"; id: string; action: A }
  | { kind: "pop" }
  | { kind: "exit" };

/** À rang égal, la DERNIÈRE de la liste répond (l'ordre de la liste = l'ordre d'activation). */
export function resolveBack<A extends string>(
  specs: readonly BackLayerSpec<A>[],
  context: { pushed: boolean },
): BackResolution<A>;

/** La plateforme doit-elle prendre l'appui d'avance ? (tvOS : `enabled` de la portée). */
export function takesBack(context: { layered: boolean; pushed: boolean }): boolean;

export function createBackLayers(): BackLayers; // la pile vivante, inchangée
```

Une règle de domaine rend ses couches en pur — par exemple
`playerBackLayers(state): BackLayerSpec<PlayerBackAction>[]` (T5) — et se
teste sans React : `resolveBack(playerBackLayers(s), { pushed: true })`.

### Adaptateur tvOS (`apps/tv/src/redesignWiring/back/BackScope.tsx`)

```ts
/** Inchangé : une couche, son gestionnaire relu à chaque appui. */
export function useBackLayer(kind: BackLayerKind, active: boolean, onBack: () => void): void;

/** Nouveau : les couches d'une règle pure, inscrites d'un appel, dans l'ordre
 *  de la liste ; `actions` relues à chaque appui. Ids préfixés par instance. */
export function useBackLayers<A extends string>(
  specs: readonly BackLayerSpec<A>[],
  actions: Readonly<Record<A, () => void>>,
): void;
```

Règles d'usage, inchangées : une vue, un menu ou un panneau qui a quelque
chose à faire au Retour s'inscrit (`menu` pour tout ce qui se ferme) ; une
Modal ajoute `onRequestClose` vers la MÊME fonction ; jamais
`usePreventRemove` ni d'intercepteur à soi sur Apple TV ; une route poussée
recule seule. La portée reste la seule à parler à UIKit.

## 17. Scénarios de référence

Dans `apps/tv/harness/nav-golden/scenarios/retour-rail/`, en données pures
(format du banc T2 adopté à sa fusion), enregistrés au SHA de référence.
La liste et ce que chacun couvre : `README.md` du dossier.

## 18. À retirer au portage Android TV

(Copies temporaires d'une règle de code partagé avec Android TV — vide pour
l'instant.)
