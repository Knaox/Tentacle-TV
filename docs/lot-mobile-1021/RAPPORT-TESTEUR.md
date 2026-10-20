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
