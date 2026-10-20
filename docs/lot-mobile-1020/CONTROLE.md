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
| erreurs-mobile | `claude/erreurs-7bb316` (exigences à préciser) | `.claude/worktrees/erreurs-7bb316` |
| web-etroit | `claude/web-etroit-3b7800` (partie de reglages) | `.claude/worktrees/web-etroit-3b7800` |

## A. Règles transverses du lot (toutes les branches)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| A1 | Un commit par étape (pas de fourre-tout) | `git log dev..branche` : commits ciblés, chacun lisible seul | ☑ commits ciblés sur les 15 branches (passes 1-2) |
| A2 | Code en anglais, commentaires et commits en français | relecture du diff (identifiants nouveaux en anglais, commentaires/commits FR) | ☑ relu par échantillon ; aucun écart relevé |
| A3 | 300 lignes max par fichier touché | `wc -l` sur chaque fichier ajouté/modifié (hors générés, i18n, JSON, tests tolérés si signalés) | ◐ seuls dépassent : `shared/src/index.ts` (353, déjà 326 sur dev), `overlayArbiter.test.ts` (test), `mobile.yml`, `project.pbxproj` (non-code) |
| A4 | Règles dans `shared` / `api-client`, pas dupliquées dans un client | relecture : aucune logique de décision recopiée mobile ↔ web/bureau | ☑ catalogues purs dans shared (W1) ; seule copie temporaire `familyRightsSummary` (web-etroit) résolue à la fusion |
| A5 | Toute nouveauté serveur derrière une capacité (`serverCapabilities.ts` shared + copie backend, test miroir vert) | diff shared/backend + `capabilitiesMirror.test.ts` vert | ☑ passe 1 : 7 capacités 1.32.0 (deviceMembership, readyGate, mobileProfiles, webProfiles, rights.live, offline.verdicts), miroir backend copié ; serveur en 1.31.0 |
| A6 | Serveur qui ne déclare rien → fonction absente sans erreur | un test par capacité nouvelle (client face à un serveur sans `capabilities`) | ☑ « un serveur qui ne déclare rien » testé par chaque session (tests de porte) ; vu en vrai : un serveur 1.31.0 du code d'intégration déclare tout |
| A7 | Aucun bump de version ; `versions.json` et les `version` des `package.json` intouchés | `git diff dev..branche -- versions.json '**/package.json'` sans changement de `version` | ☑ passe 1 (03:25) : aucune version touchée sur 13 branches |
| A8 | Pas de push, de tag, de dispatch CI | `git ls-remote origin` inchangé pour ces branches ; aucun tag nouveau | ☑ aucune branche du lot poussée, aucun tag (relevé `git ls-remote`) |
| A9 | i18n FR + EN complets pour toute clé ajoutée | clés ajoutées présentes dans `fr/` ET `en/` (script de comparaison) | ☑ passe 1 : parité des clés FR/EN sur 11 branches |
| A10 | Zéro « téléchargement / télécharger / téléchargé / download » visible sur le mobile | `grep -i` sur les chaînes visibles du mobile et les clés i18n qu'il lit (hors noms d'icônes, statuts, identifiants) | ☑ passe 1 : aucun mot interdit ajouté dans un texte visible (seulement statuts et tests de garde) |
| A11 | Clés `tentacle_*` et clés i18n jamais renommées | diff : aucune clé supprimée/renommée (seulement ajoutées) | ☑ passe 1 : aucune clé i18n ni `tentacle_*` supprimée (`readyNotifTitle` : valeur changée, clé gardée) |
| A12 | Bureau et web inchangés hors extraction Watch Together, sans régression | diff `apps/web` / `apps/desktop-electron` limité à l'extraction WT ; tests web verts | ◐ web touché par l'extraction WT, la Famille web, le web étroit et les droits — voulu ; bureau large non vérifié à l'écran |
| A13 | Tablette (iPad) propre : mises en page larges, pas d'écran étiré ni coupé | relecture (largeurs bornées, `useWindowDimensions`) + capture iPad à l'essai d'ensemble | ◐ iPad PORTRAIT vérifié (maître-détail, largeurs bornées) ; PAYSAGE non vérifiable cette nuit (capot fermé : Simulator sans fenêtre, rotation impossible) |
| A14 | Lint, typecheck et tests des paquets touchés verts (vitest `--maxWorkers=2`) | `pnpm --filter <pkg> lint/typecheck/test` sur chaque branche | ◐ base verte ; intégration déclarée verte par le coordinateur (typecheck + tests) — non rejouée ici (charge) |
| A15 | Comptes de test Knaoxtest / Knaoxtest2 seulement | relecture des bancs, fixtures, captures | ☑ bancs : comptes jetables compat-user* ; essai d'ensemble : idem, sur le Jellyfin jetable du banc |
| A16 | Pas de conflit entre sessions sur les mêmes fichiers | croisement des `git diff --name-only` des branches | ☑ conflits annoncés (Q6, Q8) résolus à la fusion |
| A17 | Mac saturé : tout travail lourd (xcodebuild, gradle, expo prebuild/run, pod install, build complet) passe par `~/.tentacle-lot-mob/heavy.sh <session> <commande>`, un seul à la fois ; vitest `--maxWorkers=1` | `~/.tentacle-lot-mob/journal.log` : chaque build lourd y a son START/END ; aucun `xcodebuild`/`gradle` hors verrou (`ps` aux passes de revue) | ◐ journal tenu ; 2 écarts relevés (D3, D4), puis consigne respectée aux passes suivantes |
| A19 | Contrôles (tsc, vitest, eslint, pnpm typecheck/lint/test) par `~/.tentacle-lot-mob/check.sh`, deux au plus pour tout le lot, paquet touché seulement, vitest `--maxWorkers=1` ; gradle par heavy.sh puis `./gradlew --stop` (consigne 03:10) | à chaque passe : `ps` (aucun tsc/vitest/eslint hors d'un parent `check.sh`, jamais plus de deux), fichiers `~/.tentacle-lot-mob/check-*.lock` | ◐ 1 écart relevé (Q9), relayé |
| A18 | Appareils : wt-banc mène la matrice (`~/.tentacle-lot-mob/devices.txt`), deux appareils au plus en tout, builds réutilisés (`builds.txt`), jamais le simulateur de base | `xcrun simctl list devices booted` aux passes de revue + `devices.txt` | ☑ matrice tenue avec wt-banc (devices.txt), jamais le simulateur de base |

## B. Watch Together — socle partagé et serveur (wt-socle)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| B1 | Logique Watch Together extraite dans `shared` / `api-client`, consommée par le web/bureau ET le mobile | diff : modules partagés + imports des deux côtés ; tests unitaires dans le paquet partagé | ☑ shared/watchTogether + api-client/watchTogether, web n'en garde que l'interface (1c3396942) |
| B2 | Bureau/web : comportement WT identique après extraction | tests web/bureau verts ; types `wt:*` inchangés | ◐ banc web↔web 58 ✔ / 0 ✘ (wt-banc) |
| B3 | Types de messages `wt:*` jamais renommés | `grep "wt:"` : aucune chaîne supprimée | ☑ aucun type `wt:*` supprimé (scan intégration) |
| B4 | Serveur : adhésion PAR APPAREIL (deux appareils d'un même compte = deux participants distincts) | test backend dédié | ☑ serveur + vu au simulateur : iPad du même compte → « Groupe… sur un autre appareil — Rejoindre ici » (captures/ipad-portrait-04-accueil.jpg, ipad-portrait-09-fiche.jpg) |
| B5 | Serveur : pas de saut d'intro avant « tous prêts » | test backend/partagé dédié | ☑ `readyGate.ts` + `syncReadyGate.test.ts` (relus) |
| B7 | Sauts rapides répétés (8 × +30 s) jamais perdus dans la salle : tous les participants finissent à la même position (signalé par wt-banc, à corriger par wt-socle) | test serveur/partagé qui rejoue la rafale + banc wt-banc rejoué vert | ☑ correctifs wt-socle + banc « appuis +30 s cumulés » vert |
| B6 | Correctifs serveur rétrocompatibles (anciens clients bureau continuent) ; capacité si le comportement visible change | test d'un client sans le nouveau champ | ☑ décision 9 de wt-socle : bureau d'avant sur 2e appareil ne suit plus implicitement (assumé) |

## C. Watch Together — mobile (wt-mobile)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| C1 | Watch Together disponible sur iPhone, iPad et Android | écran(s) + entrée dans l'app ; capture iPhone et iPad | ◐ entrée « Regarder ensemble » et feuille du groupe vues iPhone (captures/iphone-portrait-14*.jpg) ; Android non joué |
| C2 | Groupes (créer/rejoindre, liste des participants) | code + capture | ◐ feuille du groupe, invitations : vues ; à 2 personnes non joué au simulateur |
| C3 | Affinité (même règle que le bureau, depuis le partagé) | import de la règle partagée, aucune copie | ☑ modèles partagés `shared/watchTogether/ui` (wt-mobile 7) |
| C4 | Transcodage : le mobile déclare son moteur (`engineCapabilities`) ; tous synchrones même si un participant transcode | code + test | ◐ décision 8 de wt-socle ; non mesuré (pas de lecture cette nuit) |
| C5 | Entrée gardée par la capacité serveur WT ; serveur sans capacité → aucune trace | test | ☑ porte unique `useWtAvailability` (capacité deviceMembership + droits) |
| C6 | Mise en page iPad propre | capture iPad | ◐ iPad portrait : fiche et bandeau ; lecteur deux colonnes non vu (pas de lecture) |

## D. Banc multi-clients Watch Together (wt-banc)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| D1 | Banc qui rejoue plusieurs clients (bureau + mobile, deux appareils d'un même compte) | script + README | ☑ `apps/server-e2e/wt-bench` |
| D2 | Couvre l'adhésion par appareil et « tous prêts » avant saut d'intro | sortie du banc jointe | ☑ scénarios 3ᵉ appareil, intro auto/proposer |
| D3 | Jamais lancé par `pnpm test` ; comptes Knaoxtest/Knaoxtest2 | relecture | ☑ README : jamais par pnpm test |
| D4 | Simulateurs : au plus 2 en tout avec qualite ; jamais « Apple TV 4K (at 1080p) » | coordination | ☑ |

## E. Réglages mobiles restructurés (reglages)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| E1 | Sections : Compte · Lecture et apparence · TV et appareils · Hors ligne · Notifications · Aide | capture de l'écran Réglages | ☑ captures/iphone-portrait-05-reglages.jpg |
| E2 | Pastilles « Compte » / « Cet appareil » sur chaque réglage (où il s'enregistre) | capture + code (source unique de la portée) | ☑ captures/iphone-portrait-06/07/09/10*.jpg |
| E3 | Sous-titres par défaut : taille 160 % (`subtitleScale` 1,6, clé `tentacle_sub_scale`) et position 100 % (`subtitlePosition` 100, `tentacle_sub_pos`) — `engineSettings.ts` (dev : 1 / 100) | test sur les valeurs par défaut ; un utilisateur qui a déjà réglé garde sa valeur (clé lue telle quelle) ; borne max ≥ 1,6 | ☑ `engineSettings.ts` 1,6 / 100, clés gardées, borne 2 ; mpv seulement (comme avant) |
| E4 | « Réglages avancés : sur le bureau » (renvoi, pas de copie des réglages avancés) | capture | ☑ captures/iphone-portrait-07c-reglages-lecture-fin.jpg |
| E5 | Aucun réglage perdu à la restructuration (clés `tentacle_*` lues identiques) | diff des clés de stockage | ☑ clés gardées (scan) ; anciennes routes redirigées |
| E6 | Section Hors ligne sans le mot « téléchargement » | grep + capture | ☑ captures/iphone-portrait-09-reglages-hors-ligne.jpg |
| E7 | iPad : réglages en colonne bornée ou maître-détail | capture iPad | ◐ iPad portrait maître-détail (captures/ipad-portrait-05/06*.jpg) ; paysage non vu |

## F. Design (design)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| F1 | Maquette `docs/maquettes/reglages-mobile.html` | fichier présent, cohérent avec E1–E4 | ☑ `docs/maquettes/reglages-mobile.html` |
| F2 | Nouvel en-tête « Pour vous » / « Affinité » sur le mobile | code + capture | ✗ décision à confirmer : design a posé « Pour vous · Affiner », pas « Affinité » (Affinité = Watch Together) |
| F3 | Cohérent entre maquette et implémentation de reglages | comparaison | ☑ structure de reglages reprise sans écart (design) |

## G. Famille mobile (famille-mobile)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| G1 | « Qui regarde ? » = session de profil (comme le bureau) | code + capture | ☑ captures/iphone-portrait-17-qui-regarde.jpg |
| G2 | Code PIN vérifié par le serveur (jamais sur le client) | code | ☑ refus du serveur « Code incorrect — 4 essais avant blocage » (captures/iphone-portrait-19-pin-refuse.jpg) |
| G3 | Carrousels d'accueil synchronisés (même ordre/contenu que le bureau, préférence du compte) | code + capture | ◐ une seule page « Votre accueil » (l'éditeur des rangées du compte), pas de carrousels : décision de famille-mobile à confirmer |
| G4 | Photo de profil (galerie / avatars) depuis la session de profil | code + capture | ☑ galerie depuis le premier lancement (captures/iphone-portrait-03-galerie.jpg) |
| G4b | Photo de profil changeable À TOUT MOMENT sur mobile et iPad : Réglages › Compte › « Changer la photo » (galerie existante) ; photo des invités par le propriétaire ou un parent ; photo affichée partout où le profil apparaît (en-tête, Qui regarde ?, Famille, Watch Together…) | code + captures iPhone/iPad | ✗ « Photo de profil » dans Compte ✔ ; mais la puce de l'en-tête garde le COMPTE en session de profil (Q13) et la couleur du profil varie (Q14) |
| G5 | Invitations Famille visibles à l'ouverture de l'app (registre des recouvrements du démarrage, sans écraser un autre recouvrement) | code + capture | ◐ hôte des invitations monté après l'ouverture ; non provoqué au simulateur |
| G6 | « Êtes-vous encore là ? » (même règle que le bureau, partagée) | code + test | ◐ famille 95f0fdd44 : PAUSE à la fin du décompte (M10) |
| G7 | Capacités Famille respectées (`family.*`) ; serveur sans capacité → rien | test | ☑ capacité family.mobileProfiles ; « Qui regarde ? » absent sans elle (test) |

## H. Notifications (notifs)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| H1 | Notifications mobiles = celles du bureau (mêmes types) | liste des types comparée | ☑ table des types partagée, testée type par type |
| H2 | Chaque notification ouvre la bonne destination | table type → route, testée | ☑ nouveauté → fiche du titre (captures/iphone-portrait-13-notification-destination-fiche.jpg) |
| H3 | Règle de destination partagée, pas dupliquée | code | ☑ `shared/notifications` (notifs 77bfb31c7) |

## J. Lecteur mobile (lecteur-mobile)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| J1 | Heure et batterie visibles quand les commandes du lecteur s'affichent (barre d'état du système ; sinon horloge intégrée) — masquées avec les commandes | code + capture lecteur commandes visibles / cachées | ◐ code + décision (barre d'état, horloge iPhone paysage) ; non vu (pas de lecture) |
| J2 | Android : PiP natif quand une lecture EN COURS passe en arrière-plan ; jamais en pause (comme iOS) | code (condition « en lecture ») + test de la règle | ◐ `pipPolicy.ts` testé ; non vu |
| J3 | Bouton PiP dans le lecteur (Android, et iOS s'il manque) | code + capture | ◐ code ; non vu |
| J4 | Android : diffusion vers une TV sans l'app (Google Cast, ou alternative libre si la licence bloque — décision écrite) | code + décision de licence (AGPL/LGPL, cf. audit licences) | ☑ Google Cast, licence justifiée (Play services, LICENSE-EXCEPTIONS §2), garde licence verte d'après lecteur-mobile — à confirmer par Damien |
| J5 | iOS : AirPlay | code + capture du sélecteur | ◐ code ; non vu |
| J6 | Règles de décision (quand PiP, quand afficher l'heure) pures et testées, pas de `Platform.OS` dans la règle | relecture + tests | ☑ règles pures testées |
| J7 | iPad : PiP et AirPlay corrects en paysage/portrait | capture iPad | — pas de lecture cette nuit |

## K. Hors ligne en direct + Vigie (hors-ligne-live)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| K1 | iOS : Live Activity avec temps restant pendant qu'un titre est gardé hors ligne | code (extension widget) + capture | ◐ extension dans l'app partagée ; non provoquée |
| K2 | Android : notification permanente avec temps restant | code + capture/journal | ◐ code ; Android non joué |
| K3 | À la fin : remplacée par « Prêt à regarder » (plusieurs titres : comportement défini) | code + test de la règle | ◐ « Prêt à regarder hors ligne », un titre ouvre ce titre, plusieurs la bibliothèque |
| K4 | Aucun « téléchargement / download » dans ces textes (FR/EN) | grep i18n | ☑ grep |
| K5 | Échec / annulation / perte réseau : activité terminée proprement, jamais figée | code + test | ◐ règle pure testée |
| K6 | Vigie : notification « demande bloquée » avec la raison, et « ça se réglera tout seul » | code dans Tentacle-Plugin-Seer | ☑ Vigie `lot-mob/vigie-bloque` |
| K7 | Vigie : une demande bloquée n'est JAMAIS affichée « en cours » | test dans le dépôt de Vigie | ☑ « Bloquée » au centre de notifications (captures/iphone-portrait-12-notifications.jpg) |
| K8 | Vigie sur SA branche, dans le dépôt Tentacle-Plugin-Seer ; rien de Vigie dans le cœur ni dans les changelogs des apps | `git log` des deux dépôts | ☑ |
| K9 | Notification Vigie ouvre la bonne destination (cohérent avec H2) | code | ◐ sans Vigie installé : pas de destination (pas de chevron), voulu |

## M. Droits visibles = droits réels (droits-mobile, et web)

Règle de Damien : « tout ce que tu as le droit de faire, tu le vois ; le reste, tu ne le vois pas ».
Sur mobile, tablette ET web, pour tous les droits.

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| M1 | Une source unique des droits effectifs (shared/api-client) lue par mobile et web, jamais recalculée par écran | code | ☑ `/api/account/abilities` + `mayShow` (api-client) |
| M2 | Garder hors ligne : absent sans le droit (mobile, tablette) | test (sans droit → entrée absente) | ☑ « Hors ligne » présent avec le droit ; absent quand Jellyfin était arrêté (capacités illisibles) — voulu |
| M3 | Watch Together : absent sans le droit (mobile, tablette, web) | test | ☑ `watchTogetherAbility(useAccountAbilities())` (droits-mobile, branché à la fusion) |
| M4 | Gérer les bibliothèques : absent sans le droit | test | ◐ abilities `deleteTitles`… (code et tests de droits-mobile) ; non provoqué à l'écran |
| M5 | Administration : absente pour un non-administrateur, et pour une session de profil | test | ☑ invité : pas de mot de passe, Famille, serveur (captures/iphone-portrait-22-compte-invite.jpg) |
| M6 | Demandes (Vigie) : absentes sans le droit (invité sans « Peut demander », Vigie éteint ou trop ancien) | test | ◐ `useVigieGate` / profileMayRequest + droit invité ; non provoqué (pas de Vigie au banc) |
| M7 | Droits de la Famille (invité, membre) appliqués de même sur mobile, tablette et web | test | ◐ résumé partagé mobile et web étroit ; non provoqué pour un membre |
| M8 | Utilisateur désactivé : plus de connexion possible, et une session ouverte coupée proprement (message clair, pas d'écran cassé ni de boucle) | test serveur + client | ◐ `AccountAccessHost` (droits 6a08ce7b8) — adaptateur de session de profil à brancher APRÈS fusion |
| M9 | Horaires du contrôle parental : la lecture est coupée à l'heure (pas seulement refusée au démarrage) | test de la règle + lecteur | ◐ lecteur fermé à l'heure limite (6a08ce7b8) — idem |
| M10 | « Êtes-vous encore là ? » coupe bien la lecture après le délai sans réponse | test de la règle + lecteur | ◐ famille 95f0fdd44 : PAUSE à la fin du décompte (pas un arrêt) — décision à confirmer (« coupe ») |
| M11 | Mobile : droits en LECTURE SEULE + « Modifier sur le bureau ou le web » | capture + i18n | ☑ « Modifier sur le bureau ou le web » rendu ; l'affichage du volet après appui simulé est à revoir au vrai toucher (Q15) |
| M12 | Contrôle côté serveur : un client qui appelle quand même la route sans droit est refusé (masquer ne suffit pas) | tests backend existants / ajoutés | ☑ gardes serveur (tests backend de droits-mobile) |

## N. Famille sur le web (famille-web)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| N1 | Famille complète sur le WEB (pas seulement le bureau) et activable depuis le web | code + capture | ◐ serveur family.webProfiles + client ; non vu à l'écran |
| N2 | « Qui regarde ? » sur le web | code + capture | ◐ |
| N3 | Sessions de profil sur le web (PIN vérifié par le serveur) | code + test | ☑ PIN et jeton du compte en réserve côté serveur (12 tests) |
| N4 | Gestion des droits de la Famille sur le web | code + capture | ◐ interrupteurs au bureau large, lecture seule en étroit (c9407ddc5) ; non vu |
| N5 | Bureau inchangé (même code, aucune régression) ; client LG non cassé (substitutions `App.tsx`) | tests web/bureau + build webOS si `App.tsx`/pages touchés | ◐ shim webOS posé ; build webOS non rejoué ici |
| N6 | Capacités `family.*` respectées sur le web | test | ☑ capacité family.webProfiles (serveur d'avant refuse la plateforme web : rien à moitié ouvert) |

## O. Web étroit (web-etroit) — « les changements du mobile arrivent sur le web étroit sans réécriture »

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| W1 | Structure du mobile en CATALOGUES PURS dans `packages/shared`, testés : réglages (pages, sections, ordre, portée Compte/Cet appareil, clé, type de contrôle, capacité, plateformes, « réservé au bureau »), étapes du premier lancement, destinations des notifications, résumé des droits | modules shared + tests ; plus de copie dans `apps/mobile` (`profileStructure.ts`, `settingsScopes.ts` deviennent des lecteurs du catalogue) | ☑ réglages, premier lancement, notifications, droits, WT ui : dans shared |
| W2 | Le web en fenêtre étroite (téléphone, iPad, bureau rétréci) REND ces catalogues : réglages en six rubriques avec pastilles et « réglages avancés : sur le bureau », premier lancement (Qui regarde ?, PIN, carrousels, photo), destinations des notifications, en-tête « Pour vous »/« Affinité » si modèle partagé | code + captures à 390 px et 820 px | ◐ code + tests ; rendu web étroit non vu (web-etroit : « aucun rendu vérifié ») |
| W3 | Un test prouve que chaque entrée du catalogue est rendue par les deux clients, ou exclue d'un côté avec sa raison | test présent et vert | ☑ `webCoverage.test.ts` |
| W4 | Fenêtre large du bureau inchangée ; cible webOS compile ; aucune clé `tentacle_*` ni i18n renommée | build webOS (par `heavy.sh`) + scan A11 | ◐ shim webOS ; build non rejoué |
| W6 | Décision du coordinateur (03:10) : reglages déplace lui-même `profileStructure`, `profileSections`, `profilePanes`, `settingsScopes` vers `packages/shared/src/settingsCatalog/` ; web-etroit consomme seulement (champs supplémentaires demandés à reglages) ; plus personne ne retouche l'ancien emplacement après le déplacement | `git log` des deux branches : aucun commit sur `apps/mobile/src/screens/profile/{profileStructure,profileSections,profilePanes,settingsScopes}.ts` après le commit de déplacement | ☑ déplacement 6576292c4 ; hors-ligne-live a retiré son écran (2a5f6f115), reglages porte « Suivi en direct » au catalogue (252cd9144) |
| W5 | Pas de conflit avec famille-web (apps/web) ni avec reglages (catalogue déplacé pendant que reglages travaille) | croisement A16 | ☑ |

## L. Boutons (boutons)

| # | Exigence | Preuve | État |
|---|----------|--------|------|
| L1 | Boutons mobiles sobres, un composant commun (pas de styles recopiés écran par écran) | code | ☑ `components/ui/buttons` (buttonLook testé) |
| L2 | iOS : Liquid Glass façon Apple TV (repli propre sur iOS < 26) | code + capture | ◐ verre iOS 26 non vérifié à l'œil |
| L3 | Android : version plus sobre (sans verre) | code + capture | — Android non joué |
| L4 | Une seule action en couleur par écran | relecture des écrans touchés + captures | ☑ une action en couleur par écran sur toutes les captures |
| L5 | Aucune régression d'écran (tailles de cible ≥ 44 pt, états désactivé/chargement) | relecture + captures iPhone/iPad | ◐ cibles ≥ 44 pt par hitSlop (code) |
| L6 | Conflits avec reglages/famille/wt-mobile/notifs sur les mêmes écrans signalés | croisement A16 | ☑ |

## I. Essai d'ensemble (simulateur iPhone puis iPad, après fusion)

| # | Parcours | Preuve | État |
|---|----------|--------|------|
| I1 | Premier lancement (connexion, Qui regarde ?, invitations) | captures `docs/lot-mobile-1020/` | ☑ ouverture → « Qui regarde ? » → PIN → premier lancement → galerie (iPhone et iPad) |
| I2 | Réglages (sections, pastilles, sous-titres) | captures | ☑ iPhone et iPad |
| I3 | Notifications (liste, ouverture d'une destination) | captures | ☑ feuille iPhone, panneau ancré iPad, destination |
| I4 | « Pour vous » (nouvel en-tête, Affinité) | captures | ☑ « Pour vous · Affiner », sans clé TMDB |
| I5 | Watch Together de base (créer, rejoindre) | captures | ◐ créer un groupe, feuille, « Rejoindre ici » sur le 2ᵉ appareil ; pas de lecture |
| I6 | Lecteur : heure/batterie, PiP, AirPlay ; hors ligne : Live Activity ; boutons | captures | ◐ lecteur et Live Activity non provoqués (pas de lecture) |
| I0 | App de test : celle de wt-banc (`~/.tentacle-lot-mob/builds/ios/TentacleTV.app`, natif = dev + batteryStatus) ne contient PAS l'extension Live Activity (hors-ligne-live) : la reconstruire après fusion pour K1/I6 | `BUILT_FROM.txt` après fusion | — app de wt-banc reconstruite 05:34 avec tout le natif (Live Activity comprise) |
| I0b | Capot fermé cette nuit : aucune sortie audio → toute LECTURE au simulateur plante (mpv) ou cale (AVPlayer). Aucun verdict de lecteur ni de synchro au simulateur cette nuit ; lecture et Watch Together synchronisé à refaire par Damien, capot ouvert | relevé de wt-banc (`devices.txt`) | — |
| I7 | iPad PORTRAIT ET PAYSAGE, TOUS les rendus de toutes les sessions : réglages, premier lancement, galerie, Famille, droits en lecture seule, notifications, Live Activity, « Pour vous », boutons, lecteur (heure/batterie, PiP), Watch Together | une capture par rendu et par orientation dans `docs/lot-mobile-1020/` (nommées `ipad-<portrait|paysage>-<rendu>.png`) | ◐ iPad portrait fait ; paysage impossible cette nuit |

## Défauts

| N° | Branche | Où | Défaut | Envoyé | État |
|----|---------|----|--------|--------|------|
| D1 | reglages | `settingsMobile.ts` FR 47/81, EN 37/71 | « ce téléphone / this phone » affiché aussi sur tablette | reglages 03:05 | ☑ `apps/server-e2e/wt-bench` |
| D3 | lecteur-mobile | processus | build gradle hors `heavy.sh` (03:12, charge 31) | note partagée + coordinateur (rapport de fin de tour : messages bloqués par l'app) | ☑ README : jamais par pnpm test |
| D4 | notifs | processus | `tsc` sous `heavy.sh` au lieu de `check.sh` : bloque le verrou lourd | idem | ☑ |
| Q5 | hors-ligne-live | `offline.ts` `liveFinalizing` FR/EN | « sur le téléphone / on the phone » affiché sur tablette | note `qualite-passe1.md` | ouvert |
| Q6 | hors-ligne-live ⟷ reglages | `OnDeviceSettingsScreen.tsx`, `settingsCatalog` | réglage « Suivi en direct » posé hors du catalogue partagé et sur un écran réécrit par reglages → conflit + W3 | note | ouvert |
| Q7 | hors-ligne-live (Vigie) | `stalled-research.ts` | retrait + liste noire automatiques d'un transfert bloqué 6 h : comportement nouveau, à valider par Damien | note + récap | décision |
| Q8 | toutes | `shared/src/index.ts`, `serverCapabilities.ts` | ajouts concurrents sur 11 et 5 branches (conflits triviaux) ; index.ts > 300 dès dev | coordinateur | fusion |
| Q5 | → | | corrigé 0542d1691 (vérifié 05:35) | | fermé |
| Q6 | → | | résolu : 2a5f6f115 + 252cd9144 (vérifié) | | fermé |
| Q10 | droits-mobile + reglages, wt-mobile, famille, lecteur | après fusion | BRANCHEMENTS À FAIRE APRÈS FUSION (listés dans `droits-mobile.md`) : `useSessionAbilities`, `useWtAvailability`, `profileSessionAdapter`, débit/qualité/cast du lecteur — sans eux M2–M9 ne sont pas tenus | coordinateur | ouvert |
| Q11 | ouverture | `tv-core` → `shared/brandIntro`, paquet `brand-intro-native` | l'ouverture de la TV est déplacée : tests tv-core/tv et lint TV (`eslint/tvNavigation`) à rejouer ; aucune régression Apple TV / Android TV permise | coordinateur | à vérifier |
| Q12 | outillage | `heavy.sh` | un TERM pendant l'attente retire le verrou sans quitter → commande lancée hors verrou (relevé par droits-mobile) | coordinateur | ouvert |
| Q13 | famille-mobile / design | `components/header/ProfileChip.tsx` (lit `useStoredUser`) | en session de profil (Léo), la puce de l'en-tête affiche toujours le COMPTE (« compat-user ») : doit lire le profil actif (`useActiveProfile`), nom ET photo. Repro : famille à 3 profils, « Qui regarde ? » → Léo (PIN) → en-tête ; captures iphone-portrait-20/21 | rapport du matin | ouvert |
| Q14 | famille-mobile | couleurs de profil | sans photo, la pastille d'un profil change de couleur selon l'écran (Léo : sarcelle dans « Qui regarde ? » et Famille, violet sur le Profil ; propriétaire : rouge / violet) | rapport | ouvert |
| Q15 | famille-mobile | Famille › appui sur un membre | volet « Ses droits » monté dans l'arbre mais pas visible après appui SIMULÉ — à revoir au vrai toucher | rapport | à vérifier |
| Q16 | famille-mobile | i18n family | textes dépassés depuis « Qui regarde ? » sur mobile/web : « sur les téléviseurs et les ordinateurs de la famille », « Ajouter un invité — … qui ne s'ouvre que sur vos TV », « Partagez vos TV » | rapport | ouvert |
| Q17 | wt-mobile | feuille du groupe | à l'ouverture, « Quitter le groupe » est sous le bord (il faut défiler) alors que la moitié haute de l'écran est vide | rapport | mineur |
| Q18 | famille-mobile | pavé PIN | la case vide (bas gauche) a un fond de touche | rapport | mineur |
| Q19 | wt-mobile | bandeau « autre appareil » | « Groupe de compat-user en cours… » pour SON propre groupe : « Votre groupe est en cours sur un autre appareil » serait plus juste | rapport | mineur |
| Q9 | inconnue | processus | vitest `--maxWorkers=2` hors check.sh à 03:24 | note | relevé |
| D2 | wt-socle | salle WT | 8 sauts rapides (+30 s) perdus (signalé par wt-banc) | coordinateur → wt-socle | ☑ scénarios 3ᵉ appareil, intro auto/proposer |

## Décisions tranchées par les sessions

(à demander à chaque session pour le récapitulatif du matin)

## Base mesurée sur dev (`064890d94`, 20/10 02:45)

| Paquet | typecheck | lint | tests (`--maxWorkers=2`) |
|--------|-----------|------|--------------------------|
| shared | vert | vert | 219 fichiers, 1 939 tests verts |
| api-client | vert | vert | 100 fichiers, 678 tests verts |
| mobile | vert | vert (0 erreur, 7 avertissements préexistants) | 45 fichiers, 248 tests verts |

Toute régression sur une branche se compare à cette base. Depuis la consigne de charge (02:55), les revues relisent les tests passés par les sessions et ne relancent que le paquet touché, par `heavy.sh`, `--maxWorkers=1`.
