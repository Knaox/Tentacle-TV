# Watch Together — le banc et ses mesures

Rapport du banc `apps/server-e2e/wt-bench/` (mode d'emploi dans son README).
Il consigne ce qui a été MESURÉ, scénario par scénario, avant et après les
correctifs du lot du 20/10 (« mobile = bureau »). Le modèle de
synchronisation lui-même est décrit dans `WATCH-TOGETHER-SYNC.md`.

Cibles du lot : **< 100 ms en régime**, **retour < 1 s après un seek**.

## Méthode

Tous les membres tournent sur le même Mac. La position de chaque lecteur est
lue DANS l'app (web : `video.currentTime` ; iOS : la dernière annonce du
moteur, par Hermes) avec l'heure murale commune, puis ramenée à un instant
commun. La dérive est donc la vérité terrain, pas ce que les lecteurs croient
d'eux-mêmes (`driftMs` de leurs balises). Le « biais » est la médiane SIGNÉE de
l'écart d'un membre : un biais constant est un écart que la boucle de chaque
lecteur croit corrigé.

Médias : série synthétique de 3 × 5 min (720p, 6 Mb/s, chapitres « Intro »
0–40 s et « Générique »), heure du film incrustée à la milliseconde.
Transcodage : plafond de 1,5 Mb/s imposé à `PlaybackInfo` (le geste « qualité
basse »), relevé dans les requêtes (HLS).

⚠️ **Charge du Mac.** La référence (02:45–03:00) a tourné à une charge de 6 à
16 ; les rejeux de 03:05–03:20 entre 25 et 58 (huit sessions du lot en
parallèle). Les DÉLAIS mesurés sous forte charge ne valent pas mesure ; les
vérifications fonctionnelles, si.

## 1. Référence — code de `dev` (064890d94), web ↔ web, 2 Chrome

### Synchronisation

| Mesure | Lecture directe | B en transcodage |
|---|---|---|
| Départ : écart au premier instant où les deux lisent | 106 ms | 175 ms |
| Départ : du lancement à < 100 ms | 5,4 s | 7,5 s |
| Régime (30 s), pire écart | 57 ms (biais constant) | 54 ms (biais constant) |
| Pause (par l'un ou l'autre) → les deux en pause à < 50 ms | 117–119 ms | 124–147 ms |
| Lecture → les deux repartis à < 100 ms | 421–432 ms | 435 ms |
| Seek +30 s / −10 s → réalignés à < 100 ms | 734–767 ms | 752 ms |
| Scrub (→ ← → en 600 ms) → réalignés | 1 450 ms | 652 ms |
| Après une reprise / un seek (10 s) | 1–15 ms | 0–10 ms |
| À trois membres, régime | 49 ms | — |
| Membre lent (transcodage + 6 s de retard sur ses premières requêtes) | A n'avance pas sans lui (0,02 s) ; aligné 16,9 s après le lancement ; régime 0–6 ms ; seek 742 ms | |
| Coupure réseau de B, 10 s puis 35 s | B reste membre, A n'est pas arrêté, réaligné 3 ms après le retour | |

Lecture : **cibles tenues en régime** (< 100 ms) et **après un seek** (< 1 s),
sauf le scrub en lecture directe (1,45 s). Le **départ** dépasse la cible
(106–304 ms d'écart, 5–10 s pour passer sous 100 ms).

### Fonctions

| Scénario | Résultat |
|---|---|
| Création, invitation, acceptation, lancement depuis la fiche — **par l'interface** | ✔ tout (invitation reçue en 52 ms, B suit le lancement en 1,8 s) |
| Invitation arrivée pendant le chargement de l'accueil | ✔ 3/3 (deux ratés isolés ailleurs dans la nuit, non reproduits) |
| Groupe à trois ; un AUTRE groupe en parallèle | ✔ aucune trame ni lancement chez l'autre groupe ; départ d'un membre sans casse |
| Épisode suivant demandé par un membre | ✔ les deux passent à l'épisode 2 en 255 ms |
| **3ᵉ appareil du même compte** | ✘ il suit le lancement, reçoit la salle, **sa pause arrête tout le monde, son départ éjecte le compte** |
| **Intro au tout début**, hôte en « passer tout seul » | ✘ « Passer l'intro » visible avant que tous soient prêts (la salle, elle, attend) |
| **Intro au tout début**, hôte en « proposer » | ✘ un clic avant que B soit prêt emmène la salle à 40 s, B encore à 0 |
| Affinité | non jouable sur la médiathèque synthétique (corrigé dans le banc : identifiant TMDB et affiche posés) |

## 2. Défauts trouvés et remontés

| # | Défaut | Preuve | Session | État |
|---|---|---|---|---|
| 1 | Un membre qui ARRIVE démarre seul (autoplay du chargement) avant l'instant planifié : il finit 200–300 ms en avance, corrigé à −5 % en 6–10 s ; la règle « départ en retard > 250 ms → un seek » ne couvre que le retard | journal [WT] de B : `event play` à +10,9 s, `reprise planifiée : play()` à +11,3 s (pos 145,0 au lieu de 144,8), `driftS 0.282` | wt-socle | remonté |
| 2 | Biais de régime 50–57 ms : chaque lecteur sort de correction dès |écart| < 25 ms et n'y revient qu'au-dessus de 40 ms ; A s'est posé à −24 ms, B à +25 ms | journaux `recalé — vitesse 1× {driftS: -0.024}` / `{driftS: 0.025}` | wt-socle | remonté (amélioration, sous la cible) |
| 3 | 3ᵉ appareil (cf. tableau) | scénario `third-device` | wt-socle | **corrigé côté serveur** (voir § 3) |
| 4 | « Passer l'intro » avant que tous soient prêts | scénario `intro-gate` | wt-socle | serveur : saut automatique gardé ✔ ; clic manuel encore accepté (un `wt:seek`) — attend le client web |
| 5 | ~~Appuis → martelés perdus en séance~~ : PAS un défaut de Watch Together — le lecteur web SEUL fond aussi cinq appuis à 80 ms en un seul saut (+29,6 s) ; en séance, +28,6 s, les deux membres au même endroit | scénario `seek-hammer` | — | clos (comportement du lecteur, à juger par Damien) |

## 3. Rejeu sur le serveur de wt-socle (adhésion par appareil, « tous prêts »)

Branche `claude/wt-socle-686749` (a6df368da) fusionnée dans le banc ; client
web encore celui de `dev`.

| Vérification | Référence | wt-socle (serveur) |
|---|---|---|
| Le 3ᵉ appareil ne suit pas le lancement | ✘ | ✔ |
| … ne reçoit aucun `wt:state` | ✘ 20 trames | ✔ 0 |
| … `GET /group` → `null`, `GET /group/elsewhere` → la salle | ✘ | ✔ |
| … sa pause n'arrête pas la salle | ✘ | ✔ `wt:error not_in_group` |
| … son « quitter » ne retire personne | ✘ | ✔ 404 |
| … sa fermeture n'éjecte personne (15 s) | ✘ | ✔ |
| « Rejoindre ici » ajoute l'appareil sans retirer le premier | — | ✔ |
| Bandeau « Groupe en cours sur un autre appareil » (web) | — | ✘ client web pas encore livré |
| Intro [auto] : la salle ne saute pas sans B | ✔ | ✔ |
| Intro [auto] : pas de bouton avant « tous prêts » | ✘ | ✘ client web pas encore livré |
| Intro [proposer] : un clic précoce n'emmène pas la salle | ✘ | ✘ le clic est un `wt:seek`, accepté |
| Affinité : séance, match en direct, « Regarder ensemble » suivi par les deux | — | ✔ (lancement → alignement 12 s, sous charge 40+) |

Constat (voulu ?) : un appareil FERMÉ garde le compte dans la salle le temps
de sa grâce (120 s) ; pendant ce temps un nouvel appareil du compte reçoit
409 en créant un groupe, et « rejoindre ici » + « quitter » ne le libère pas.

## 4. iPhone, iPad, Android

_À compléter : app iOS de dev partagée en construction ; clients mobiles de
wt-mobile pas encore lançables de bout en bout._

## 5. Ce qui reste

_À compléter en fin de nuit._
