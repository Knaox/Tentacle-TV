# Rapport du contrôleur — lot de nuit « mobile = bureau » (20/10)

Session **qualite**. Check-list détaillée, ligne par ligne, avec ses preuves : [CONTROLE.md](CONTROLE.md).
Captures de l'essai d'ensemble : [captures/](captures/) (iPhone 17 Pro et iPad Pro 11 M5, iOS 26.3,
branche `lot-mob/integration` = `dev` 1cf5af56d, serveur du même code sur le Jellyfin JETABLE du banc
Watch Together, comptes jetables `compat-user*` — jamais un compte réel).

## En bref

- **15 branches suivies, 2 passes de revue complètes** (03:25, 05:30), puis l'intégration (06:30) :
  aucune version touchée, aucune clé `tentacle_*` ni i18n supprimée, parité FR/EN des clés, zéro
  « téléchargement / download » visible sur le mobile, 7 capacités serveur 1.32.0 recopiées dans le backend.
- **Essai d'ensemble au simulateur (sans lecture : capot fermé, aucune sortie audio)** : ouverture animée,
  « Qui regarde ? », code PIN vérifié par le serveur, premier lancement, galerie, réglages en six rubriques
  avec pastilles, 160 % / 100 %, « Réglages avancés : sur l'app bureau », centre de notifications (feuille
  sur iPhone, panneau ancré sur iPad) et sa destination, « Pour vous · Affiner », Watch Together (feuille du
  groupe, « Rejoindre ici » sur le 2ᵉ appareil du même compte), session de profil d'un invité, serveur coupé
  (mode hors ligne, sans voile). **Tout conforme**, sauf les défauts ci-dessous.
- **Pas vérifiable cette nuit** : toute LECTURE (lecteur, heure/batterie, PiP, AirPlay, Cast, synchro Watch
  Together au simulateur, Live Activity provoquée), l'iPad en **paysage** (sans écran, le Simulator n'a pas
  de fenêtre : la rotation est impossible), Android (étapes b et c de la matrice), le web étroit à l'écran.

## Défauts restants (à corriger)

| N° | Où | Défaut | Preuve / repro |
|----|----|--------|----------------|
| Q13 | `apps/mobile/src/components/header/ProfileChip.tsx` | En **session de profil**, la puce de l'en-tête garde le nom et l'initiale du COMPTE (elle lit `useStoredUser`, jamais `useActiveProfile`). Contredit « la photo affichée partout où le profil apparaît ». | Famille à 3 profils → « Qui regarde ? » → Léo (PIN) → l'en-tête dit « compat-user », le Profil dit « Léo » : `captures/iphone-portrait-20*.jpg`, `21*.jpg` |
| Q14 | profils sans photo | La couleur d'un profil change selon l'écran (Léo : sarcelle dans « Qui regarde ? » et Famille, violet sur le Profil ; propriétaire : rouge / violet). | `iphone-portrait-17`, `21`, `24` |
| Q16 | i18n `family` | Textes dépassés depuis que le mobile et le web ont « Qui regarde ? » : « sur les téléviseurs et les ordinateurs de la famille », « Ajouter un invité — un profil… qui ne s'ouvre que sur vos TV », « Partagez vos TV ». | `iphone-portrait-24-famille.jpg` |
| Q15 | Famille › appui sur un membre | Le volet « Ses droits » (avec « Modifier sur le bureau ou le web ») est monté mais ne s'est pas affiché après un appui SIMULÉ : à revoir au vrai toucher. | `iphone-portrait-25*.jpg` |
| Q17 | feuille du groupe Watch Together | « Quitter le groupe » est sous le bord à l'ouverture alors que la moitié haute est vide. | `iphone-portrait-14*.jpg` |
| Q18 | pavé du code PIN | La case vide en bas à gauche a un fond de touche. | `iphone-portrait-18-pin.jpg` |
| Q19 | bandeau « autre appareil » | « Groupe de compat-user en cours sur un autre appareil » pour SON propre groupe : « Votre groupe… » serait plus juste. | `ipad-portrait-04-accueil.jpg` |
| Q8 | `packages/shared/src/index.ts` | 353 lignes (326 sur dev, déjà au-delà de 300) : à découper en sous-index. | scan |

Corrigés dans la nuit et vérifiés : D1 « ce téléphone » sur tablette (reglages), Q5 « sur le téléphone »
(hors-ligne-live), Q6 réglage « Suivi en direct » hors catalogue (reglages + hors-ligne-live), D2/B7 sauts
rapides perdus dans la salle (wt-socle, prouvé par le banc : rafales de +30 s 58 ✔ / 0 ✘).

## Décisions à confirmer par Damien

1. **« Pour vous · Affiner »** et non « Affinité » (design : « Affinité » reste le nom du jeu du Watch Together).
2. **« Vous regardez encore ? » met en PAUSE** à la fin du décompte (comme le bureau), Damien avait dit « coupe ».
3. **Vigie retire et met en liste noire** un transfert bloqué 6 h sans un octet, pour tenir « ça se réglera tout
   seul » (hors-ligne-live, `stalled-research.ts`) — changement de comportement de Vigie, pas seulement un avis.
4. **Premier lancement = une seule page « Votre accueil »** (l'éditeur des rangées du compte), pas un carrousel de
   trois pages (famille-mobile).
5. **Google Cast** sur Android (SDK de Google Play services, même régime que Firebase dans LICENSE-EXCEPTIONS) ; le
   jeton de la session passe dans l'URL envoyée au Chromecast, comme Jellyfin Web (lecteur-mobile).
6. **Sous-titres 160 %** : seulement avec le lecteur avancé (mpv) ; AVPlayer et ExoPlayer gardent le style du système.
7. **Watch Together : un bureau d'avant** sur un 2ᵉ appareil ne suit plus la salle implicitement tant qu'il n'est pas
   à jour (wt-socle, adhésion par appareil).
8. **CI iOS** : `mobile.yml` crée un 2ᵉ identifiant et un 2ᵉ profil App Store (extension Live Activity) sur la fiche
   partagée `com.tentacle.mobile` — jamais éprouvé en CI ; à surveiller au premier cran test.
9. **Mise à jour serveur nécessaire** pour : adhésion par appareil, « tous prêts », Famille mobile et web, droits en
   direct, verdict hors ligne (capacités 1.32.0 ; `versions.json` → `server` est resté 1.31.0, aucun bump cette nuit).

## Décisions tranchées par chaque session (pour le récapitulatif)

- **reglages** : six rubriques (Compte · Lecture et apparence · TV et appareils · Hors ligne · Notifications · Aide et
  à propos), « Changer de serveur » et « Vider le cache » rangés dans Compte ; pastille sur chaque réglage (inventaire
  `shared/settingsCatalog/settingsControls.ts`) ; langue = Compte, thème = Cet appareil ; « Mode de lecture » remplacé
  par « Intros et résumés » (Proposer · Passer · Laisser) + « Épisode suivant automatique » ; segmentés au lieu des
  listes à coche ; options expertes du lecteur gardées mais repliées ; maître-détail tablette gardé ; anciennes routes
  redirigées ; session de profil : mot de passe, Famille, serveur, invitations, sessions, suppression, TV, Notifications,
  Hors ligne masqués. Le catalogue vit dans `packages/shared/src/settingsCatalog/` (décision du coordinateur).
- **design** : pastille « Pour vous · Affiner » fixée sous l'en-tête ; maquette `docs/maquettes/reglages-mobile.html`
  (avec la section Boutons) ; puce du profil dans l'en-tête pour changer de profil en un geste.
- **wt-socle** : un appareil = le jeton ; « Rejoindre ici » ajoute l'appareil ; « Quitter » par appareil ; grâce de
  120 s par appareil ; expulser = le compte entier ; « tous prêts » (60 s au plus, barrière qui suspend) ; aucun saut
  de passage avant ; transcodage sans nouveau seuil faute de mesure ; jeton de seek + regroupement 150 ms (B7).
- **wt-mobile** : « Regarder ensemble » en pilule secondaire sur la fiche ; chat interactif (emojis du bureau, GIF,
  rafales regroupées) ; iPad deux colonnes dans le lecteur ; modèles d'interface dans `shared/watchTogether/ui`.
- **wt-banc** : banc rejouable (`apps/server-e2e/wt-bench`), 58 ✔ / 0 ✘ au dernier passage web ; iOS mesuré hors
  synchro (capot fermé) ; Android non joué.
- **famille-mobile** : « Qui regarde ? » plein écran si serveur 1.32.0 et ≥ 2 profils, choix toujours retenu ; pavé PIN ;
  premier lancement une fois par profil et par appareil (code conseillé, accueil, photo) ; « Vous regardez encore ? »
  en pause ; sur iPad, tout centré et borné à 640.
- **famille-web** : session de profil dans le navigateur avec le jeton du COMPTE gardé par le serveur (cookie
  `tentacle_account_token`, jamais rendu à la page) ; plateforme `web` (capacité `family.webProfiles`) ; plusieurs
  onglets suivent le même profil.
- **droits-mobile** : `GET /api/account/abilities` (capacité 1.32.0) lu par `mayShow` ; `rights:changed` en direct ;
  titres gardés hors ligne vérifiés pour l'identité ; droits de la Famille en lecture seule sur le mobile ; compte
  désactivé ou hors de ses heures : page au-dessus de tout, lecteur fermé à l'heure. Trouvé non fermé :
  `EnableRemoteAccess` de Jellyfin pas appliqué derrière Tentacle (carte proposée « acces-distance »).
- **notifs** : table des destinations unique (shared) testée type par type ; centre façon bureau, panneau ancré sur
  tablette ; Watch Together sans notification (comme le bureau).
- **lecteur-mobile** : vraie barre d'état avec les commandes, horloge dessinée sur iPhone en paysage ; PiP Android
  seulement pendant une lecture ; Google Cast (DLNA écarté) ; quitter le lecteur arrête la diffusion.
- **hors-ligne-live** : Live Activity iOS (extension liée faiblement) et notification permanente Android, fin lissée ;
  « Prêt à regarder hors ligne » ouvre le titre ; réglage « Suivi en direct » (Cet appareil) ; Vigie « demande
  bloquée » une fois par blocage, jamais « en cours ».
- **boutons** : cinq composants (Primary, Secondary, Plain, Glass, Icon), une seule action en couleur par écran, le
  danger jamais en pavé rouge, verre seulement monté quand il est affiché.
- **web-etroit** : le web étroit rend les catalogues partagés (réglages, premier lancement, notifications, droits) ;
  test de couverture qui exige chaque entrée ou sa raison d'exclusion ; Watch Together en fenêtre étroite NON fait.
- **erreurs-mobile** : catalogue des causes (shared), une limite d'erreur par écran, code du support sous chaque message,
  bandeau discret.
- **ouverture-mobile** : l'ouverture animée de la TV portée sur iPhone, iPad et Android (paquet `brand-intro-native`,
  règles déplacées de tv-core vers shared) ; « Qui regarde ? » s'ouvre APRÈS l'arrivée de l'ouverture.

## Respect des règles de la nuit

- Un commit par étape, code en anglais et commentaires en français : respectés partout où j'ai relu.
- Charge du Mac (jusqu'à 166) : deux écarts relevés à 03:12 (gradle hors `heavy.sh`, `tsc` sous `heavy.sh`) et un
  vitest à `--maxWorkers=2` à 03:24 ; respect ensuite. Relevé de droits-mobile : `heavy.sh` lance la commande hors
  verrou si on l'interrompt pendant l'attente (trap sans `exit`).
- Simulateurs : deux appareils au plus, jamais le simulateur de base ; les miens sont éteints et le Jellyfin jetable
  réarrêté (`devices.txt`).

## À faire capot ouvert (Damien)

1. Lecture sur iPhone et iPad : heure/batterie, PiP, AirPlay ; Watch Together synchronisé (`bench:wt up` puis
   `run ios-pair`, `run ios-web`).
2. iPad en paysage : tous les écrans ci-dessus (rotation impossible cette nuit).
3. Android (tablette et téléphone) : PiP, Cast, notification permanente des transferts, boutons sobres.
4. Web étroit à 390 px et 820 px (`?formFactor=phone|tablet`).
5. Q15 au vrai toucher (volet des droits d'un membre).
