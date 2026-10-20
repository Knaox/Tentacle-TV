# Retours de l'alpha mobile — rapport du testeur (20/10)

Session **testeur-mobile**. Simulateurs « WT banc iPhone (Testeur) » (iPhone 17 Pro) et « WT banc iPad (Testeur) »
(iPad Pro 11 M5), iOS 26.3, capot ouvert. App de dev partagée (natif inchangé depuis builds.txt), JS par Metro 8097
depuis ma branche d'essai `claude/testeur-36264d` (dev 7a7722ba7 + fusions des branches à tester, jamais dans dev).
Serveur : backend de la branche d'essai sur le Jellyfin JETABLE du banc Watch Together (comptes `compat-user*`,
famille de test : compat-user propriétaire, invités Léo — PIN — et Mia, sans photo ; sous-titres .srt ajoutés aux
épisodes du banc). Captures : [captures/](captures/) (`avant-*` sur dev, `apres*-*` sur les branches), constats AVANT :
[CAPTURES-AVANT.md](CAPTURES-AVANT.md), mesures Release : [mesures-ouverture-release.txt](mesures-ouverture-release.txt).

## AVANT / APRÈS, point par point (demande de Damien)

| Point | AVANT (dev 7a7722ba7) | APRÈS | Branche (dernière tête essayée) |
|---|---|---|---|
| Logo jamais déformé | ✘ étiré (haut sur iPhone portrait, écrasé en paysage) | ✔ proportions du logo sur iPhone portrait, iPad portrait et paysage ; seule la fenêtre de la vitre prend la forme de l'appareil | ouverture-v2 fdc4e781e → d42bc9c17 |
| Plongée dans le VRAI premier écran | ✘ plongée dans l'accueil puis « Qui regarde ? » en fondu par-dessus | ✔ accueil (compat-user2, iPad portrait/paysage), choix du serveur (sans serveur) ; ◐ « Qui regarde ? » est bien le premier écran mais la plongée y était SAUTÉE (1 image) — corrigé par ouverture-v2 (f2a69d89a, attente de l'accueil caché), à revoir à l'image ; mesuré en Release : 0 image perdue dans la plongée | ouverture-v2 + famille-demarrage |
| Fluidité (mesure Release, 60 Hz simulateur) | iPhone accueil : plongée 23–26 images perdues, pire 400–444 ms (2 fois sur 3) | plongée 0 perdue, pire 17 ms ; **l'assemblage perd toujours** 65–74 images (pire 0,5–0,7 s) sur iPhone, ~33 (0,26 s) sur iPad, avant comme après | ouverture-v2 d42bc9c17 |
| « Qui regarde ? » à chaque démarrage à froid sauf case cochée | ✘ une fois un profil choisi, plus jamais | ✔ revient à chaque démarrage (même avec l'ancienne mémoire de la veille), case « Ne plus proposer au démarrage » décochée, légende Réglages › Compte ; case cochée → profil ouvert directement ; ligne « « Qui regarde ? » au démarrage » (Cet appareil) dans Réglages › Compte, rallumable | famille-demarrage 1bd615f46 |
| … pas au retour d'arrière-plan | — | ✔ ne revient pas | famille-demarrage |
| … depuis la session d'un profil (Mia) | — | ✘ rouvre Mia sans « Qui regarde ? » (vu avant 74cc8177a ; à revérifier, famille-demarrage dit « non voulu ») | famille-demarrage |
| Photo proposée pour un profil sans photo | ◐ propriétaire oui (étape 3/3) ; ✘ Mia : « Étape 1 sur 1 », pas de photo | ✔ Mia : « Étape 1 sur 2 · Votre accueil » puis « Étape 2 sur 2 · Votre photo », la galerie s'ouvre | famille-demarrage |
| Barre du haut du lecteur collée en haut (iPhone paysage) | ✘ ~60 pt sous le bord si la lecture a été lancée en portrait puis tournée | ✔ collée en haut après rotation en lecture | lecteur-apple e0b3b810e → 2f55f3f3f |
| Feuilles du lecteur claires, façon Apple, sans voile noir | ✘ feuilles sombres, voile noir sur la vidéo (épisodes), panneaux sombres petits caractères | ✔ (2e passe, Liquid Glass allumé) plaques en verre lisibles, sans voile, commandes du centre effacées, panneau latéral entre les rangées en paysage ; 1re passe : panneaux TRANSPARENTS (corrigé) ; ✘ étagère des épisodes rognée à gauche (« pisodes ») en iPhone paysage — corrigé par lecteur-apple 2f55f3f3f, 3e passe NON faite | lecteur-apple |

## Repasses de 12:30–12:55 (têtes : ouverture-v2 77a598b04, famille-demarrage 204c790bc, lecteur-apple 2f55f3f3f, wt-gel 2a17aa66e)

- **Ouverture** : poulpe figé NON reproduit (compat-user2 → accueil ; compat-user avec session de profil périmée et liste en 401 →
  accueil). Mesures Release : iPad **parfait** (0 image perdue, 17 ms, 6/6) ; iPhone : trou résiduel d'assemblage 20–26 perdues /
  350–460 ms (contre 65–74 / 0,5–0,7 s avant), encre 1,5–1,65 s au plafond ; la `timeline` montre `hydrated` ~1 s après la première
  image et un 2e montage (~0,4 s) qui tombe pile sur `intro:start` ([mesures-ouverture-release-apres4.txt](mesures-ouverture-release-apres4.txt)).
- **Lecteur (3e passe)** : ✔ partout — portrait (barre sous l'îlot), paysage îlot à gauche et à droite (barre collée, « Épisodes »
  entier, 1re vignette entière, panneaux à l'écart de l'îlot).
- **Watch Together (wt-gel)** : ✔ tout le parcours sans gel, iPhone hôte + iPad invité : Regarder ensemble → feuille du groupe →
  Inviter → la feuille revient ; sur l'iPad la galerie d'avatars puis la boîte des invitations s'ouvre d'elle-même ; Accepter ;
  Trouver quoi regarder → Affinité chez les deux → match → lecture ensemble ; dans le lecteur, panneau du groupe → « Voir le groupe ».
  ✘ **Damien : « sur iPad le mode Affinité n'est pas du tout adapté »** — mise en page du téléphone étirée
  (`apres-wtgel-ipad-5-pile.jpg`), renvoyé à wt-gel.
- **Famille, session de Mia** : pas de « Qui regarde ? » au démarrage depuis la session d'un profil — cause trouvée côté banc :
  au simulateur `expo-secure-store` échoue (« A required entitlement isn't present », app de test non signée) → la réserve du compte
  n'est jamais écrite → id du compte null. **Non vérifiable au simulateur** : à refaire sur un vrai iPhone (TestFlight).
- **Galerie d'avatars pendant le lecteur** : ✔ elle paraît au retour à l'accueil (1cdbaa278).

## Fin de journée (13:00–13:20)

- **Ouverture, mesure Release apres5** (ouverture-v2 2ae84348f + famille-demarrage 1bd615f46) : **12/12 démarrages à 0 image
  perdue, pire écart 17 ms**, iPhone et iPad, accueil et « Qui regarde ? » ; plus aucun trou après le départ de l'animation.
  Cause du dernier trou trouvée au Time Profiler : le halo flouté du héros de l'accueil (`HeroAmbilightFilter`, filtre SVG rendu
  par CoreImage) dessiné au départ de l'animation ([mesures-ouverture-release-apres5.txt](mesures-ouverture-release-apres5.txt)).
  Encre : 1,2 s (iPhone) à 1,4 s (iPad) ; du JS à l'arrivée ≈ 4,8–5,0 s.
- **Affinité sur iPad (wt-gel 7e6d0cc1e)** : ✔ portrait et paysage (colonne centrée, carte à la hauteur, boutons dessous, match
  centré), iPhone inchangé ; restes mineurs : choix du type collé en haut, texte de la carte en taille téléphone ; panneau du
  groupe translucide dans le lecteur en paysage.
- **Pas fait** : Inviter / Trouver / Quitter depuis le lecteur en paysage, essai admin-famille, points 5–6 de famille-demarrage
  et politique admin, deux lots Live Activity de live-fix, mesure de synchronisation Watch Together iOS (banc `ios-pair` bloqué
  plus tôt par l'ouverture ; à relancer).

## Notes de l'après-midi (13:15–13:45)

- **Couleurs du lecteur faussées au simulateur** (bleu/magenta/cyan qui virent au vert et à l'orangé, par blocs, sur certaines
  captures iPhone) : cause trouvée par banc-episodes — c'est le **décodeur vidéo du simulateur** (Safari montre la même corruption
  sur le même flux ; ffmpeg et VideoToolbox du Mac le décodent juste). Les captures de lecture au simulateur ne disent rien des
  couleurs : seul un vrai appareil fait foi.
- **Alerte d'autorisation des notifications d'iOS** : restée en attente au simulateur, invisible, elle a capté les touchers et
  figé l'ouverture (faux bloquants retirés après redémarrage du simulateur). ouverture-v2 fait maintenant attendre la demande
  jusqu'à l'arrivée de l'ouverture (6bc5ac63b) ; vérifié : deux démarrages après réinstallation sans blocage, 0 image perdue.
- **Watch Together, orientation** (wt-gel 14a3af7ce) : ✔ « Voir le groupe » et la confirmation de sortie restent en paysage depuis
  le lecteur ; ✔ la feuille reste en portrait sur une page verrouillée en portrait. Reste : feuille du groupe tassée en paysage.
- **Live Activity (live-fix)** : l'activité est créée et s'affiche sur l'écran verrouillé ; mais au banc, deux transferts
  (Allégé, puis Original 220 Mio) n'ont reçu aucun octet en 3 min — l'activité reste sur « Calcul du temps restant… ». Probablement
  le banc (serveur/URL de transfert), à vérifier sur un vrai appareil ; live-fix a arrêté ses essais.

## Mesure de synchronisation Watch Together iOS (banc `ios-pair`, 13:50–14:00) — NON OBTENUE

Quatre passages : ✔ session de l'iPhone, ✔ création du groupe (après remise à zéro du backend : un groupe de l'essai manuel restait
tenu par d'anciens appareils, 409), ✔ invitation reçue sur l'iPad, ✔ l'iPhone (A) lance et lit la lecture ; ✘ l'iPad (B) ne suit pas :
il reste sur « Qui regarde ? » de la famille de compat-user alors que le banc y a posé compat-user2
(`captures/banc-wt-ios-pair-ipad-bloque-qui-regarde.png`). Cause côté banc : l'app de test non signée ne peut pas écrire dans le
trousseau (« A required entitlement isn't present »), donc la session posée par le banc ne remplace pas proprement celle d'avant.
→ Pour mesurer la synchro iOS : deux simulateurs NEUFS (jamais connectés à compat-user), ou un build simulateur signé.
Parcours Watch Together à la main : ✔ de bout en bout, sans gel (voir plus haut).

## Défauts relevés et renvoyés (par session)

- **famille-demarrage** : porte figée sur « rien » avant /api/config (corrigé 74cc8177a) ; galerie d'avatars ouverte
  pendant le lecteur, invisible, qui retenait le portier des modales (corrigé 1cdbaa278, non revérifié) ; Mia gardée en
  session → pas de « Qui regarde ? » (à revérifier) ; constat : l'invitée Mia ne peut pas lire (`playbackStart/notAllowed`).
- **ouverture-v2** : plongée sautée dans « Qui regarde ? » (correctif f2a69d89a) ; **poulpe figé à vie** (> 3 min) dans
  deux cas — session de profil périmée + session du compte reposée ; puis accueil monté et liste du sélecteur en erreur 401
  — filet des 8 s posé (d42bc9c17), non revérifié à l'écran ; assemblage qui perd 0,5–0,7 s sur iPhone (mesure).
- **lecteur-apple** : verre transparent (corrigé 6f780f57d) ; marges sûres du portrait en paysage, étagère rognée
  (corrigé 2f55f3f3f, non revérifié).
- **wt-gel** : iPhone ✔ (Inviter depuis la fiche, la feuille du groupe revient) ; iPad ✘ boîte des invitations jamais
  présentée (feuille invisible qui retenait le portier ; BottomSheet démontée par la sortie interrompue) — corrigé 2a17aa66e,
  non revérifié.

## Watch Together (banc `ios-pair`, capot ouvert)

Deux essais : le 1er bloqué par les noms des simulateurs (le banc cherche « WT banc iPhone/iPad ») ; le 2e (simulateurs
renommés et redémarrés) : ✔ session de l'iPhone, ✔ création du groupe, ✔ invitation reçue sur l'iPad, ✘ « B suit le
lancement de A » — l'iPhone (A) était resté figé sur le poulpe de l'ouverture (défaut ci-dessus), donc **aucune mesure de
synchronisation iOS** cette fois.

## Pas fait / restes

- 3e passe lecteur-apple (2f55f3f3f), revérification wt-gel (2a17aa66e) et famille-demarrage (1cdbaa278, points 5, 6,
  politique admin), essai admin-famille, 2 lots live-fix, mesure WT iOS : simulateurs prêtés à banc-episodes à 12:18.
- Android : rien (émulateur non utilisé).
- L'app de dev de l'iPhone a cessé de répondre aux touchers après plusieurs relances (aucune modale ouverte) — non élucidé.
