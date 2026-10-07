# Mode Lite — la non-régression (L7, 07/10)

Ce qui a été rejoué sur `dev` à `aeab988e5` (L0, L1, L2, L3, L4, L5a, L6 ;
**sans L5b**, le montage borné, pas encore fusionné). APK de mesure
(`com.tentacletv.mobile.perf`, release + debug) construites sur ce commit,
faux backend nav-golden. Garde des touches sur chaque séquence.

Verdicts : **OK** (tenu), **KO** (non tenu), **partiel**.

## 1. Shield, mode normal = la mesure de départ de L1

Images ratées (%), deux passes. La colonne « L1, même jour » est l'APK de L1
rejouée le 07/10 au matin, en alternance avec celle de L7 : la Shield de ce
jour-là n'est pas celle de la nuit (pires images plus longues avec les DEUX
APK, ~+70 Mo de PSS au départ, dont ~30 Mo de code mappé).

| Écran | L1 (nuit) | L1, même jour | L7 | Verdict |
|---|---|---|---|---|
| Démarrage → accueil prêt | 35 % · 2,98 s | 39 % · 3,02 s | 31-35 % · 2,96-2,98 s | OK |
| Focus d'une carte | 21-26 % | 42 % | 22-28 % | OK |
| Défilement tenu | 60 % | 59 % | 58-63 % | OK |
| Rail | 64 % | — | 65,5 % | OK (une image de 424 ms, isolée) |
| Rotation du héros | 31 % | 40 % | 32-60 % (APK L6 alternée : 34-44 %) | OK (bruit du geste : 125 images) |
| Fiche | 37-39 % | 39 % | 39-42 % | OK (+3,4 au pire) |
| Recherche | 30-40 % | — | 42 % (31 images) | à surveiller (4 images de plus) |
| Lecteur | 20-23 % | — | 14 % | OK |
| Ouvrir « Films » | 61 % | 60 % | 56-58 % | OK |
| Saisons et épisodes | 30 % | — | 24 % (3 116 vues au lieu de 3 618) | OK |
| Réglages | 20 % | — | 22 % | OK |
| Grille tenue | 70,5 % | — | 72 % | OK |

**Mémoire, 10 min** (même parcours, même jour, même Shield) :

| | Départ | 10 min | Repos après | Vues vivantes |
|---|---|---|---|---|
| APK L1 | 378 Mo | **622 Mo** (natif 298) | 664 Mo | 1 814 → **9 457** |
| APK L7, normal | 384 Mo | **477 Mo** (natif 188) | 507 Mo | 1 805 stables |

La rétention des vues est finie (L6) : **−145 Mo** à 10 min, croissance
+93 Mo au lieu de +244. Le 350-380 Mo attendu n'est **pas** atteint (477) :
la croissance qui reste n'est pas du cache d'images (« privateOther », le tas
de Hermes surtout : 95 → 145 Mo).

## 2. Shield, Lite forcé (`debug.tentacle.lite 1`)

Tout fonctionne : les 12 écrans joués deux fois, saisons comprises, aucun
plantage.

| Geste | Normal | Lite | Pire image (Lite) | Objectif | Verdict |
|---|---|---|---|---|---|
| Focus d'une carte | 28 % | **6,1 %** | 26 ms | < 10 % | OK |
| Défilement tenu | 63 % | **31 %** | 39 ms | < 20 % | KO |
| Grille tenue | 72 % | **43 %** | 36 ms | < 20 % | KO |
| Rail | 65,5 % | 43 % | **208 ms** | 0 > 100 ms | KO |
| Recherche (frappe) | 42 % | 27 % | **210 ms** | 0 > 100 ms | KO |
| Saisons et épisodes | 24 % | **8-9 %** | 118-120 ms | — | mieux |
| Fiche (page) | 39 % | 14 % | 177 ms | < 250 ms | OK |
| Ouvrir « Films » (page) | 56 % | 46 % | 152 ms | < 250 ms | OK |
| Réglages | 22 % | 20 % | 132-152 ms | — | = |
| Démarrage | 31 % · 2,98 s | 37 % · 2,84 s | 644 ms | — | = |

Mémoire Lite : **286-298 Mo** au repos (objectif < 170 : KO), **480 Mo** à
10 min (objectif < 220 : KO). En 10 min, le Lite ne fait pas mieux que le
normal sur la Shield (480 contre 477). La différence au repos tient au GPU
(`Other mtrack` 38 Mo contre 57).

## 3. AVD 1 Go (`Lite_L7_1G`, Android TV 12, 2 cœurs, sans frein)

| Mode | Passes | Écrans | Endurance | Repos | Verdict |
|---|---|---|---|---|---|
| Lite (auto, `lowRam`) | 5 | les 9 mesurables joués, lecteur compris, **aucune mort** (5/5) | **tuée au 2e tour**, 3/3 (lmkd, premier plan, RSS 251-276 Mo) ; 2 passes arrêtées avant par le défaut de banc corrigé en `bb0d8b59a` | 171-195 Mo | **KO** (le parcours complet ne tient pas) |
| Normal (`debug.tentacle.lite 0`) | 2 | focus, accueil, rail, fiche, recherche, Films, réglages joués | **tuée au lecteur 2 fois sur 2**, puis dans la grille (RSS 290 Mo) | 190-191 Mo | utilisable par moments, 3 morts |

Saisons et épisodes : jamais mesuré sur cet AVD (la mise en place n'atteint
pas la fiche, défaut de banc connu depuis L0). Les 5 premières passes du
matin ont figé au lancement à froid (tuée avant sa première image, juste
après le démarrage de l'émulateur, l'APK de L6 comprise) : le lancement est
désormais borné à 2 min (`a41ca47e5`).

## 4. Réglages › Apparence

AVD 2 Go, app de mesure, compte de test du faux backend. Trois tours
Automatique → Activé → Désactivé → Automatique, soit 9 changements : chacun
termine le processus (voulu) et rouvre **Réglages › Apparence**, compte
Knaoxtest toujours là, niveau relu (`userOn` → lite, `userOff` → normal,
`lowRam` → lite). Aucun `FATAL`, aucune mort du tueur de processus : **OK**.
Note : en rentrant dans les pastilles après le redémarrage, le focus va sur
« Automatique », pas sur la pastille choisie (déjà dit par L2).

## 5. Apple TV inchangée, Android sans changement de logique

| Banc | Résultat | Verdict |
|---|---|---|
| nav-golden tvOS, 145 scénarios (simulateur neuf `nav-T8`) | 143 identiques ; `pc-16` et `bandeau-hors-ligne-sortie` diffèrent **à l'identique** à la révision pré-Lite `a0ed0f01d` | OK |
| back-trace | iOS, Android, Android refondu : identiques à `84f3cedd0` | OK |
| player-trace | tvOS 43 réussis ; androidtv 31 réussis (2 et 7 ignorés, comme avant) | OK |
| panels-trace | 9/10 identiques ; `offline` diffère par ses textes seulement (les mots de la connectivité, déjà dans `a0ed0f01d`) | OK |
| nav-golden `--android`, contre les références tvOS | voir plus bas | OK |

`nav-golden --android` (AVD 2 Go, normal) : 51 identiques à l'Apple TV, 92
écarts, rejoués écart pour écart au JS pré-Lite `a0ed0f01d` (même natif) :

- 22 écarts autres que des cadres : **18 identiques** ;
  `fenetre-des-demandes` **mieux** après (le rail du pré-Lite mène à
  « Films ») ; `rail-24-bibliotheques` : l'app passe en arrière-plan pendant un
  BAS maintenu, **avant comme après** (bogue Android antérieur au Lite) ;
  `retour-lecteur` : trois `DELETE /Videos/ActiveEncodings` en quittant le
  lecteur. Cela vient de la règle de L3 : l'émulateur n'a aucun décodeur
  matériel, donc la vidéo est convertie par le serveur, puis la conversion est
  arrêtée en sortant. Avec le profil Shield simulé
  (`debug.tentacle.media_profile shield`), le scénario est identique au
  pré-Lite ;
- 71 écarts de cadre seulement : **70 identiques** au pré-Lite ; le 71e, `reglages-navigation-deplacer`, est l'écart connu de L2 (ordre des onglets aligné sur l'Apple TV) : 22 écarts avant, un seul cadre après.

## 6. Le dépôt

`pnpm typecheck` : 0 erreur (tous les paquets). `pnpm lint` : 0 erreur
(avertissements préexistants). Tests : tv-core 1 294, shared 1 376,
api-client 495, bancs android-perf 12 et nav-golden 21 : tout vert.

## Ce que seule la vraie box net+ dira

Le budget réel avant le tueur de processus (`isLowRamDevice`, zram, tas de
box), le GPU VideoCore V (les images ratées de l'émulateur saturent), le
processeur A53/B53 (seuil du micro-test, 0,7, estimé), le démarrage < 4 s,
les décodeurs (direct play réel au lieu de la conversion de l'émulateur), et
les objectifs de fluidité du Lite sur un appareil qui en a besoin.
