# Contrôle du lot de nuit « mobile = bureau » (20/10)

Contrôleur : session **qualite**. Base commune : `dev` = `064890d94`.
Une ligne par exigence ; « Preuve » dit ce qui la coche. Légende : ☐ à faire ·
☑ prouvé · ✗ défaut ouvert (voir « Défauts ») · — sans objet.

Branches suivies (une par worktree, `git worktree list`) :

| Session | Branche | Worktree |
|---------|---------|----------|
| wt-socle | `claude/wt-socle-686749` | `.claude/worktrees/wt-socle-686749` |
| wt-mobile | `claude/wt-mobile-f7c020` | `.claude/worktrees/wt-mobile-f7c020` |
| wt-banc | `claude/wt-banc-7d7150` | `.claude/worktrees/wt-banc-7d7150` |
| reglages | `claude/reglages-b5e8c7` | `.claude/worktrees/reglages-b5e8c7` |
| design | `claude/design-887719` | `.claude/worktrees/design-887719` |
| famille-mobile | `claude/famille-20ba01` | `.claude/worktrees/famille-20ba01` |
| notifs | `claude/notifs-c5bb92` | `.claude/worktrees/notifs-c5bb92` |
| lecteur-mobile | `claude/lecteur-959931` | `.claude/worktrees/lecteur-959931` |
| hors-ligne-live | `claude/hors-ligne-live-5c07b6` (+ branche à part dans Tentacle-Plugin-Seer) | `.claude/worktrees/hors-ligne-live-5c07b6` |
| boutons | `claude/boutons-517d48` | `.claude/worktrees/boutons-517d48` |
| droits-mobile | `claude/droits-06ed6b` | `.claude/worktrees/droits-06ed6b` |
| famille-web | `claude/famille-web-350294` | `.claude/worktrees/famille-web-350294` |
| web-etroit | `claude/web-etroit-3b7800` (partie de reglages) | `.claude/worktrees/web-etroit-3b7800` |

## A. Règles transverses du lot (toutes les branches)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| A1 | Un commit par étape (pas de fourre-tout) | `git log dev..branche` : commits ciblés, chacun lisible seul | ☐ |
| A2 | Code en anglais, commentaires et commits en français | relecture du diff (identifiants nouveaux en anglais, commentaires/commits FR) | ☐ |
| A3 | 300 lignes max par fichier touché | `wc -l` sur chaque fichier ajouté/modifié (hors générés, i18n, JSON, tests tolérés si signalés) | ☐ |
| A4 | Règles dans `shared` / `api-client`, pas dupliquées dans un client | relecture : aucune logique de décision recopiée mobile ↔ web/bureau | ☐ |
| A5 | Toute nouveauté serveur derrière une capacité (`serverCapabilities.ts` shared + copie backend, test miroir vert) | diff shared/backend + `capabilitiesMirror.test.ts` vert | ☐ |
| A6 | Serveur qui ne déclare rien → fonction absente sans erreur | un test par capacité nouvelle (client face à un serveur sans `capabilities`) | ☐ |
| A7 | Aucun bump de version ; `versions.json` et les `version` des `package.json` intouchés | `git diff dev..branche -- versions.json '**/package.json'` sans changement de `version` | ☐ |
| A8 | Pas de push, de tag, de dispatch CI | `git ls-remote origin` inchangé pour ces branches ; aucun tag nouveau | ☐ |
| A9 | i18n FR + EN complets pour toute clé ajoutée | clés ajoutées présentes dans `fr/` ET `en/` (script de comparaison) | ☐ |
| A10 | Zéro « téléchargement / télécharger / téléchargé / download » visible sur le mobile | `grep -i` sur les chaînes visibles du mobile et les clés i18n qu'il lit (hors noms d'icônes, statuts, identifiants) | ☐ |
| A11 | Clés `tentacle_*` et clés i18n jamais renommées | diff : aucune clé supprimée/renommée (seulement ajoutées) | ☐ |
| A12 | Bureau et web inchangés hors extraction Watch Together, sans régression | diff `apps/web` / `apps/desktop-electron` limité à l'extraction WT ; tests web verts | ☐ |
| A13 | Tablette (iPad) propre : mises en page larges, pas d'écran étiré ni coupé | relecture (largeurs bornées, `useWindowDimensions`) + capture iPad à l'essai d'ensemble | ☐ |
| A14 | Lint, typecheck et tests des paquets touchés verts (vitest `--maxWorkers=2`) | `pnpm --filter <pkg> lint/typecheck/test` sur chaque branche | ☐ |
| A15 | Comptes de test Knaoxtest / Knaoxtest2 seulement | relecture des bancs, fixtures, captures | ☐ |
| A16 | Pas de conflit entre sessions sur les mêmes fichiers | croisement des `git diff --name-only` des branches | ☐ |
| A17 | Mac saturé : tout travail lourd (xcodebuild, gradle, expo prebuild/run, pod install, build complet) passe par `~/.tentacle-lot-mob/heavy.sh <session> <commande>`, un seul à la fois ; vitest `--maxWorkers=1` | `~/.tentacle-lot-mob/journal.log` : chaque build lourd y a son START/END ; aucun `xcodebuild`/`gradle` hors verrou (`ps` aux passes de revue) | ☐ |
| A18 | Appareils : wt-banc mène la matrice (`~/.tentacle-lot-mob/devices.txt`), deux appareils au plus en tout, builds réutilisés (`builds.txt`), jamais le simulateur de base | `xcrun simctl list devices booted` aux passes de revue + `devices.txt` | ☐ |

## B. Watch Together — socle partagé et serveur (wt-socle)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| B1 | Logique Watch Together extraite dans `shared` / `api-client`, consommée par le web/bureau ET le mobile | diff : modules partagés + imports des deux côtés ; tests unitaires dans le paquet partagé | ☐ |
| B2 | Bureau/web : comportement WT identique après extraction | tests web/bureau verts ; types `wt:*` inchangés | ☐ |
| B3 | Types de messages `wt:*` jamais renommés | `grep "wt:"` : aucune chaîne supprimée | ☐ |
| B4 | Serveur : adhésion PAR APPAREIL (deux appareils d'un même compte = deux participants distincts) | test backend dédié | ☐ |
| B5 | Serveur : pas de saut d'intro avant « tous prêts » | test backend/partagé dédié | ☐ |
| B7 | Sauts rapides répétés (8 × +30 s) jamais perdus dans la salle : tous les participants finissent à la même position (signalé par wt-banc, à corriger par wt-socle) | test serveur/partagé qui rejoue la rafale + banc wt-banc rejoué vert | ✗ |
| B6 | Correctifs serveur rétrocompatibles (anciens clients bureau continuent) ; capacité si le comportement visible change | test d'un client sans le nouveau champ | ☐ |

## C. Watch Together — mobile (wt-mobile)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| C1 | Watch Together disponible sur iPhone, iPad et Android | écran(s) + entrée dans l'app ; capture iPhone et iPad | ☐ |
| C2 | Groupes (créer/rejoindre, liste des participants) | code + capture | ☐ |
| C3 | Affinité (même règle que le bureau, depuis le partagé) | import de la règle partagée, aucune copie | ☐ |
| C4 | Transcodage : le mobile déclare son moteur (`engineCapabilities`) ; tous synchrones même si un participant transcode | code + test | ☐ |
| C5 | Entrée gardée par la capacité serveur WT ; serveur sans capacité → aucune trace | test | ☐ |
| C6 | Mise en page iPad propre | capture iPad | ☐ |

## D. Banc multi-clients Watch Together (wt-banc)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| D1 | Banc qui rejoue plusieurs clients (bureau + mobile, deux appareils d'un même compte) | script + README | ☐ |
| D2 | Couvre l'adhésion par appareil et « tous prêts » avant saut d'intro | sortie du banc jointe | ☐ |
| D3 | Jamais lancé par `pnpm test` ; comptes Knaoxtest/Knaoxtest2 | relecture | ☐ |
| D4 | Simulateurs : au plus 2 en tout avec qualite ; jamais « Apple TV 4K (at 1080p) » | coordination | ☐ |

## E. Réglages mobiles restructurés (reglages)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| E1 | Sections : Compte · Lecture et apparence · TV et appareils · Hors ligne · Notifications · Aide | capture de l'écran Réglages | ☐ |
| E2 | Pastilles « Compte » / « Cet appareil » sur chaque réglage (où il s'enregistre) | capture + code (source unique de la portée) | ☐ |
| E3 | Sous-titres par défaut : taille 160 % (`subtitleScale` 1,6, clé `tentacle_sub_scale`) et position 100 % (`subtitlePosition` 100, `tentacle_sub_pos`) — `engineSettings.ts` (dev : 1 / 100) | test sur les valeurs par défaut ; un utilisateur qui a déjà réglé garde sa valeur (clé lue telle quelle) ; borne max ≥ 1,6 | ☐ |
| E4 | « Réglages avancés : sur le bureau » (renvoi, pas de copie des réglages avancés) | capture | ☐ |
| E5 | Aucun réglage perdu à la restructuration (clés `tentacle_*` lues identiques) | diff des clés de stockage | ☐ |
| E6 | Section Hors ligne sans le mot « téléchargement » | grep + capture | ☐ |
| E7 | iPad : réglages en colonne bornée ou maître-détail | capture iPad | ☐ |

## F. Design (design)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| F1 | Maquette `docs/maquettes/reglages-mobile.html` | fichier présent, cohérent avec E1–E4 | ☐ |
| F2 | Nouvel en-tête « Pour vous » / « Affinité » sur le mobile | code + capture | ☐ |
| F3 | Cohérent entre maquette et implémentation de reglages | comparaison | ☐ |

## G. Famille mobile (famille-mobile)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| G1 | « Qui regarde ? » = session de profil (comme le bureau) | code + capture | ☐ |
| G2 | Code PIN vérifié par le serveur (jamais sur le client) | code | ☐ |
| G3 | Carrousels d'accueil synchronisés (même ordre/contenu que le bureau, préférence du compte) | code + capture | ☐ |
| G4 | Photo de profil (galerie / avatars) depuis la session de profil | code + capture | ☐ |
| G4b | Photo de profil changeable À TOUT MOMENT sur mobile et iPad : Réglages › Compte › « Changer la photo » (galerie existante) ; photo des invités par le propriétaire ou un parent ; photo affichée partout où le profil apparaît (en-tête, Qui regarde ?, Famille, Watch Together…) | code + captures iPhone/iPad | ☐ |
| G5 | Invitations Famille visibles à l'ouverture de l'app (registre des recouvrements du démarrage, sans écraser un autre recouvrement) | code + capture | ☐ |
| G6 | « Êtes-vous encore là ? » (même règle que le bureau, partagée) | code + test | ☐ |
| G7 | Capacités Famille respectées (`family.*`) ; serveur sans capacité → rien | test | ☐ |

## H. Notifications (notifs)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| H1 | Notifications mobiles = celles du bureau (mêmes types) | liste des types comparée | ☐ |
| H2 | Chaque notification ouvre la bonne destination | table type → route, testée | ☐ |
| H3 | Règle de destination partagée, pas dupliquée | code | ☐ |

## J. Lecteur mobile (lecteur-mobile)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| J1 | Heure et batterie visibles quand les commandes du lecteur s'affichent (barre d'état du système ; sinon horloge intégrée) — masquées avec les commandes | code + capture lecteur commandes visibles / cachées | ☐ |
| J2 | Android : PiP natif quand une lecture EN COURS passe en arrière-plan ; jamais en pause (comme iOS) | code (condition « en lecture ») + test de la règle | ☐ |
| J3 | Bouton PiP dans le lecteur (Android, et iOS s'il manque) | code + capture | ☐ |
| J4 | Android : diffusion vers une TV sans l'app (Google Cast, ou alternative libre si la licence bloque — décision écrite) | code + décision de licence (AGPL/LGPL, cf. audit licences) | ☐ |
| J5 | iOS : AirPlay | code + capture du sélecteur | ☐ |
| J6 | Règles de décision (quand PiP, quand afficher l'heure) pures et testées, pas de `Platform.OS` dans la règle | relecture + tests | ☐ |
| J7 | iPad : PiP et AirPlay corrects en paysage/portrait | capture iPad | ☐ |

## K. Hors ligne en direct + Vigie (hors-ligne-live)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| K1 | iOS : Live Activity avec temps restant pendant qu'un titre est gardé hors ligne | code (extension widget) + capture | ☐ |
| K2 | Android : notification permanente avec temps restant | code + capture/journal | ☐ |
| K3 | À la fin : remplacée par « Prêt à regarder » (plusieurs titres : comportement défini) | code + test de la règle | ☐ |
| K4 | Aucun « téléchargement / download » dans ces textes (FR/EN) | grep i18n | ☐ |
| K5 | Échec / annulation / perte réseau : activité terminée proprement, jamais figée | code + test | ☐ |
| K6 | Vigie : notification « demande bloquée » avec la raison, et « ça se réglera tout seul » | code dans Tentacle-Plugin-Seer | ☐ |
| K7 | Vigie : une demande bloquée n'est JAMAIS affichée « en cours » | test dans le dépôt de Vigie | ☐ |
| K8 | Vigie sur SA branche, dans le dépôt Tentacle-Plugin-Seer ; rien de Vigie dans le cœur ni dans les changelogs des apps | `git log` des deux dépôts | ☐ |
| K9 | Notification Vigie ouvre la bonne destination (cohérent avec H2) | code | ☐ |

## M. Droits visibles = droits réels (droits-mobile, et web)

Règle de Damien : « tout ce que tu as le droit de faire, tu le vois ; le reste, tu ne le vois pas ».
Sur mobile, tablette ET web, pour tous les droits.

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| M1 | Une source unique des droits effectifs (shared/api-client) lue par mobile et web, jamais recalculée par écran | code | ☐ |
| M2 | Garder hors ligne : absent sans le droit (mobile, tablette) | test (sans droit → entrée absente) | ☐ |
| M3 | Watch Together : absent sans le droit (mobile, tablette, web) | test | ☐ |
| M4 | Gérer les bibliothèques : absent sans le droit | test | ☐ |
| M5 | Administration : absente pour un non-administrateur, et pour une session de profil | test | ☐ |
| M6 | Demandes (Vigie) : absentes sans le droit (invité sans « Peut demander », Vigie éteint ou trop ancien) | test | ☐ |
| M7 | Droits de la Famille (invité, membre) appliqués de même sur mobile, tablette et web | test | ☐ |
| M8 | Utilisateur désactivé : plus de connexion possible, et une session ouverte coupée proprement (message clair, pas d'écran cassé ni de boucle) | test serveur + client | ☐ |
| M9 | Horaires du contrôle parental : la lecture est coupée à l'heure (pas seulement refusée au démarrage) | test de la règle + lecteur | ☐ |
| M10 | « Êtes-vous encore là ? » coupe bien la lecture après le délai sans réponse | test de la règle + lecteur | ☐ |
| M11 | Mobile : droits en LECTURE SEULE + « Modifier sur le bureau ou le web » | capture + i18n | ☐ |
| M12 | Contrôle côté serveur : un client qui appelle quand même la route sans droit est refusé (masquer ne suffit pas) | tests backend existants / ajoutés | ☐ |

## N. Famille sur le web (famille-web)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| N1 | Famille complète sur le WEB (pas seulement le bureau) et activable depuis le web | code + capture | ☐ |
| N2 | « Qui regarde ? » sur le web | code + capture | ☐ |
| N3 | Sessions de profil sur le web (PIN vérifié par le serveur) | code + test | ☐ |
| N4 | Gestion des droits de la Famille sur le web | code + capture | ☐ |
| N5 | Bureau inchangé (même code, aucune régression) ; client LG non cassé (substitutions `App.tsx`) | tests web/bureau + build webOS si `App.tsx`/pages touchés | ☐ |
| N6 | Capacités `family.*` respectées sur le web | test | ☐ |

## O. Web étroit (web-etroit) — « les changements du mobile arrivent sur le web étroit sans réécriture »

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| W1 | Structure du mobile en CATALOGUES PURS dans `packages/shared`, testés : réglages (pages, sections, ordre, portée Compte/Cet appareil, clé, type de contrôle, capacité, plateformes, « réservé au bureau »), étapes du premier lancement, destinations des notifications, résumé des droits | modules shared + tests ; plus de copie dans `apps/mobile` (`profileStructure.ts`, `settingsScopes.ts` deviennent des lecteurs du catalogue) | ☐ |
| W2 | Le web en fenêtre étroite (téléphone, iPad, bureau rétréci) REND ces catalogues : réglages en six rubriques avec pastilles et « réglages avancés : sur le bureau », premier lancement (Qui regarde ?, PIN, carrousels, photo), destinations des notifications, en-tête « Pour vous »/« Affinité » si modèle partagé | code + captures à 390 px et 820 px | ☐ |
| W3 | Un test prouve que chaque entrée du catalogue est rendue par les deux clients, ou exclue d'un côté avec sa raison | test présent et vert | ☐ |
| W4 | Fenêtre large du bureau inchangée ; cible webOS compile ; aucune clé `tentacle_*` ni i18n renommée | build webOS (par `heavy.sh`) + scan A11 | ☐ |
| W6 | Décision du coordinateur (03:10) : reglages déplace lui-même `profileStructure`, `profileSections`, `profilePanes`, `settingsScopes` vers `packages/shared/src/settingsCatalog/` ; web-etroit consomme seulement (champs supplémentaires demandés à reglages) ; plus personne ne retouche l'ancien emplacement après le déplacement | `git log` des deux branches : aucun commit sur `apps/mobile/src/screens/profile/{profileStructure,profileSections,profilePanes,settingsScopes}.ts` après le commit de déplacement | ☐ |
| W5 | Pas de conflit avec famille-web (apps/web) ni avec reglages (catalogue déplacé pendant que reglages travaille) | croisement A16 | ☐ |

## L. Boutons (boutons)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| L1 | Boutons mobiles sobres, un composant commun (pas de styles recopiés écran par écran) | code | ☐ |
| L2 | iOS : Liquid Glass façon Apple TV (repli propre sur iOS < 26) | code + capture | ☐ |
| L3 | Android : version plus sobre (sans verre) | code + capture | ☐ |
| L4 | Une seule action en couleur par écran | relecture des écrans touchés + captures | ☐ |
| L5 | Aucune régression d'écran (tailles de cible ≥ 44 pt, états désactivé/chargement) | relecture + captures iPhone/iPad | ☐ |
| L6 | Conflits avec reglages/famille/wt-mobile/notifs sur les mêmes écrans signalés | croisement A16 | ☐ |

## I. Essai d'ensemble (simulateur iPhone puis iPad, après fusion)

| # | Parcours | Preuve | État |
|---|----------|--------|------|
| I1 | Premier lancement (connexion, Qui regarde ?, invitations) | captures `docs/lot-mobile-1020/` | ☐ |
| I2 | Réglages (sections, pastilles, sous-titres) | captures | ☐ |
| I3 | Notifications (liste, ouverture d'une destination) | captures | ☐ |
| I4 | « Pour vous » (nouvel en-tête, Affinité) | captures | ☐ |
| I5 | Watch Together de base (créer, rejoindre) | captures | ☐ |
| I6 | Lecteur : heure/batterie, PiP, AirPlay ; hors ligne : Live Activity ; boutons | captures | ☐ |
| I7 | iPad PORTRAIT ET PAYSAGE, TOUS les rendus de toutes les sessions : réglages, premier lancement, galerie, Famille, droits en lecture seule, notifications, Live Activity, « Pour vous », boutons, lecteur (heure/batterie, PiP), Watch Together | une capture par rendu et par orientation dans `docs/lot-mobile-1020/` (nommées `ipad-<portrait|paysage>-<rendu>.png`) | ☐ |

## Défauts

| N° | Branche | Où | Défaut | Envoyé | État |
|----|---------|----|--------|--------|------|
| D1 | reglages | `settingsMobile.ts` FR 47/81, EN 37/71 | « ce téléphone / this phone » affiché aussi sur tablette | reglages 03:05 | ouvert |
| D2 | wt-socle | salle WT | 8 sauts rapides (+30 s) perdus (signalé par wt-banc) | coordinateur → wt-socle | ouvert |

## Décisions tranchées par les sessions

(à demander à chaque session pour le récapitulatif du matin)

## Base mesurée sur dev (`064890d94`, 20/10 02:45)

| Paquet | typecheck | lint | tests (`--maxWorkers=2`) |
|--------|-----------|------|--------------------------|
| shared | vert | vert | 219 fichiers, 1 939 tests verts |
| api-client | vert | vert | 100 fichiers, 678 tests verts |
| mobile | vert | vert (0 erreur, 7 avertissements préexistants) | 45 fichiers, 248 tests verts |

Toute régression sur une branche se compare à cette base. Depuis la consigne de charge (02:55), les revues relisent les tests passés par les sessions et ne relancent que le paquet touché, par `heavy.sh`, `--maxWorkers=1`.
