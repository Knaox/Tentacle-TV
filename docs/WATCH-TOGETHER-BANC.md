# Watch Together — le banc et ses mesures

Rapport du banc `apps/server-e2e/wt-bench/` (mode d'emploi dans son README).
Il consigne ce qui a été MESURÉ dans la nuit du 20/10/2026 (lot « mobile =
bureau »), avant et après les correctifs de wt-socle (serveur, partagé, web) et
de wt-mobile. Le modèle de synchronisation est décrit dans
`WATCH-TOGETHER-SYNC.md`.

Cibles du lot : **< 100 ms en régime**, **retour < 1 s après un seek**.

## Méthode

Tous les membres tournent sur le même Mac. La position de chaque lecteur est
lue DANS l'app (web : `video.currentTime` ; iOS : la dernière annonce du moteur,
par Hermes) avec l'heure murale commune (`Date.now()`), puis ramenée à un
instant commun. La dérive est la vérité terrain, pas ce que les lecteurs
croient (`driftMs` de leurs balises). Le **biais** est la médiane SIGNÉE de
l'écart d'un membre : un biais constant est un écart que la boucle de chaque
lecteur croit corrigé.

Médias : série synthétique de 3 × 5 min (720p, 6 Mb/s, chapitres « Intro »
0–40 s et « Générique », heure incrustée à la milliseconde). Transcodage :
plafond de 1,5 Mb/s imposé à `PlaybackInfo` (le geste « qualité basse »),
vérifié dans les requêtes (HLS). Comptes : ceux du Jellyfin JETABLE du banc
(`compat-user`, `compat-user2`, `wtbench-user3/4`), jamais un compte réel.

### Trois pièges d'environnement rencontrés (et neutralisés)

1. **Veille profonde du Mac** (04:56–05:14) : tout gelé 18 min. Depuis, `run`
   tient un `caffeinate -s`.
2. **Capot fermé** (dès 03:40) : la seule sortie audio (haut-parleurs) ne
   consomme plus. Dans Chrome, l'horloge média calait puis sautait par pas de
   1,8 s (même un lecteur SEUL restait figé) — contourné par
   `--disable-audio-output`. **Au simulateur iOS, pas de contournement** : mpv
   abandonne au démarrage audio (`AURemoteIO::Start`, délai RPC) et AVPlayer
   cale à la première seconde → mesures iOS à faire capot ouvert.
3. **Charge du Mac** (jusqu'à 166 pendant les constructions Xcode/Gradle du
   lot) : les délais mesurés sous forte charge ne valent pas mesure.

Les chiffres « au calme » ci-dessous sont ceux de 05:43–05:55 (charge 5–15,
audio factice).

## 1. Web ↔ web — `dev` (référence) puis wt-socle

### Synchronisation (2 Chrome, membre B en lecture directe ou en transcodage)

| Mesure | `dev` (02:45) | wt-socle, au calme — direct | wt-socle, au calme — B transcode |
|---|---|---|---|
| Départ : écart au premier instant où les deux lisent | 106–304 ms | 0 ms | 20 ms |
| Départ : du lancement à < 100 ms (arrivée sur le lecteur comprise) | 5,4–9,7 s | 3,5 s | 2,6 s |
| Régime 30 s, pire écart p50 / p95 / max | 57 / 57 / 59 ms (biais 57) | 1 / 4 / 8 ms (biais +1) | 0 / 5 / 9 ms (biais 0) |
| Pause → les deux en pause à < 50 ms | 117–147 ms | 122–129 ms | 119 ms |
| Lecture → les deux repartis à < 100 ms | 421–435 ms | 422–431 ms | 422–430 ms |
| Seek +30 s / −10 s → réalignés à < 100 ms | 734–767 ms | 692–1 111 ms | 688–1 509 ms |
| Scrub → ← → en 600 ms | 652–1 450 ms | 1 261 ms (après le correctif B7-bis) | 1 941 ms |
| Onglet caché 20 s / page gelée 10 s → réaligné | — | 0 ms / 8 ms | 0 ms / 3 ms |
| Membre lent (transcode + 6 s de retard) : A n'avance pas sans lui | ✔ 0,02 s | ✔ 0,06 s | |
| … puis régime, seek | 0–6 ms, 742 ms | 3–9 ms, 707 ms | |
| À trois membres, régime | 49 ms | 1–2 ms | |
| Coupure réseau de B, 10 s puis 35 s → réaligné au retour | 3 ms | 2 ms | |
| Épisode suivant demandé par un membre → aligné | 7,1 s | 0,9 s | |
| Fin naturelle → enchaînement automatique pour les deux | non mesuré (appuis perdus) | ✔ | |

**Cibles tenues** : régime < 10 ms partout (cible 100), retour après un seek
< 1 s en lecture directe ; en transcodage, un saut hors tampon attend les
nouveaux segments de Jellyfin (0,7–1,5 s).

### Fonctions

| Scénario | `dev` | wt-socle |
|---|---|---|
| Création, invitation, acceptation, lancement depuis la fiche — par l'interface | ✔ | ✔ |
| Invitation arrivée pendant le chargement de l'accueil | ✔ 3/3 | ✔ |
| Groupe à trois ; un autre groupe en parallèle ; départ d'un membre | ✔ | ✔ |
| **3ᵉ appareil du même compte** : ne suit pas le lancement, ne reçoit rien, sa pause n'agit pas, son départ n'éjecte personne | ✘ (tout) | ✔ (tout) |
| … bandeau « Groupe en cours sur un autre appareil » + « Rejoindre ici » (ajout, pas transfert) | — | ✔ |
| **Intro au tout début** [auto] : rien avant « tous prêts », saut commun ensuite | ✘ bouton visible | ✔ réaligné 519 ms |
| **Intro** [proposer] : bouton absent tant que B charge, présent une fois tous prêts | ✘ (B laissé à 0 s) | ✔ |
| **Intro** [proposer] : le clic de B emmène les deux après l'intro | — | ✔ A 40,2 s · B 40,1 s, réalignés en 1,4 s |
| Appuis +30 s martelés (5 en 400 ms) | ✘ +30 s | ✔ +147 s seul et en séance, 0 ms d'écart |
| Affinité : séance, match en direct, « Regarder ensemble » suivi | — | ✔ aligné en 2,1 s |
| Chat en rafale : 25 réactions → 25 reçues, UNE bulle « ×N » | — | ✔ |
| Chat : 12 messages → 10 envoyés (plafond client) / 10 reçus | — | ✔ |
| « X est en train d'écrire… » : chez l'autre en ~40 ms, jamais chez soi, éteint à l'envoi et 4,1 s après la dernière frappe, rien au repos | — | ✔ |

## 2. Défauts trouvés et remontés

| # | Défaut | Session | État |
|---|---|---|---|
| 1 | Un membre qui arrive démarre seul (autoplay) avant l'instant planifié : 200–300 ms en avance, 6–10 s pour se recaler | wt-socle | corrigé (45be910ad) — départ 0 ms mesuré |
| 2 | Biais de régime 50–57 ms (sortie de correction à 25 ms de chaque côté) | wt-socle | corrigé (b4e8a1099, sortie à 8 ms) — biais ±1 ms mesuré |
| 3 | 3ᵉ appareil : suit le lancement, sa pause arrête la salle, son départ éjecte le compte | wt-socle | corrigé (adhésion par appareil) |
| 4 | « Passer l'intro » avant que tous soient prêts ; un clic précoce emmène la salle sans B | wt-socle | corrigé (allReady, garde du « prêt » sans barrierId) |
| 5 | Appuis +30 s rapprochés perdus (seul comme en séance) | wt-socle (B7) | corrigé (25c768931) |
| B7-bis | Après un saut DISTANT, le premier « +30 s » d'un membre partait de la cible de ce saut : appui perdu | wt-socle | corrigé (3c430087b) — ✔ scrub réaligné en 1,26 s |
| 6 | Boîte « Invitations » restée ouverte par-dessus le lecteur après une acceptation faite ailleurs | wt-socle | corrigé (bbfb410eb, `wt:inviteGone`) |
| M1 | Mobile : après le saut automatique de l'intro, aucun « prêt » → salle gelée 60 s puis membres déclarés « ne peut pas lire » ; « prêt » sans barrierId | wt-mobile + wt-socle | corrigé (a23e7a1e8, a45a727b4) |
| M2 | Mobile : « Passer l'intro » affiché avant le chargement | wt-mobile | corrigé (b63c0ee3f) |
| M3 | Mobile : « je cale » toutes les ~5 s, trois gels de 60 s | wt-mobile | corrigé (edc785ba4) ; en partie l'artefact audio du capot fermé |
| M4 | Position aberrante 1 069 s → double « épisode suivant » | wt-socle | corrigé (c1863e347, l'anti-gel ne relance plus une salle gelée) |
| M5 | Mobile : départ à la reprise Jellyfin personnelle (41,7 s) au lieu de la position de la salle → interblocage | wt-mobile | corrigé (867cd3698) — ✔ vérifié au simulateur (B part de 0 s) |

## 3. iPhone et iPad (simulateurs)

« WT banc iPhone (Claude) » (iPhone 17 Pro) et « WT banc iPad (Claude) » (iPad
Pro 11 M5), iOS 26.3, app de dev partagée du lot, JS du Metro du banc
(wt-mobile + sonde de dev `__wtBench`), serveur de wt-socle. Session posée
sans geste, lecture par Hermes, navigation par le routeur d'expo-router.

| Vérification | 1ᵉʳ passage (03:39) | 2ᵉ passage (05:27) |
|---|---|---|
| Les deux apps parlent au backend avec leur session | ✔ | ✔ |
| L'iPad reçoit l'invitation (« Accepter / Refuser / Plus tard ») | ✔ | ✔ |
| L'iPad suit le lancement de l'iPhone jusqu'au lecteur | ✔ 556 ms | ✔ 1 087 ms |
| L'iPad part de la position de la salle, pas de sa reprise (41,7 s) | — | ✔ 0,0 s |
| Départ aligné à < 100 ms | 46,8 s (gels M1/M3) | 10,3 s (charge 166) |
| Régime, gestes, arrière-plan | non mesurables | non mesurables |

**Non vérifié** : la synchro iOS au calme. Capot fermé, la lecture au
simulateur est impossible (voir les pièges). À faire capot ouvert :
`pnpm --filter @tentacle-tv/server-e2e bench:wt run ios-pair` (iPhone + iPad,
~10 min) puis `ios-web` (iPhone + web).

## 4. Apps de test partagées du lot

Construites une fois par wt-banc depuis la branche d'essai
`claude/wt-banc-essai-natif` (930159a58 = dev + lecteur-mobile 78b33afe8 +
hors-ligne-live 0542d1691 + ouverture-mobile 90fbcdfda, fusion sans conflit) :
app iOS simulateur arm64 (05:34) et APK debug (05:39). Chemins :
`~/.tentacle-lot-mob/builds.txt`. Scripts : `apps/server-e2e/wt-bench/devices/`.

## 5. Ce qui reste

- **iOS au calme, capot ouvert** : `ios-pair` puis `ios-web` (étapes a et d).
- **Android** (étapes b, c) : non joué — émulateur lent sous la charge, et même
  piège audio probable capot fermé. APK partagé prêt.
- Dernier passage web (06:05, wt-socle 5a1f78504 + wt-mobile 3e31c1b91 :
  invitation, synchro directe, intro, 3ᵉ appareil, appuis martelés, chat,
  affinité) : **58 vérifications ✔, 0 ✘**. Transcodage, membre lent, réseau,
  épisode suivant et groupe à trois mesurés au passage précédent (7f894807a),
  pas rejoués sur la toute dernière tête.
- GIF du chat non joués (Klipy hors d'atteinte du banc) ; Electron (bureau)
  non joué — le web en tient lieu.
