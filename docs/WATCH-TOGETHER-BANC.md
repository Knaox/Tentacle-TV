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

## 3. Rejeu sur wt-socle (serveur puis client web)

Branche `claude/wt-socle-686749` fusionnée dans le banc : serveur seul
(a6df368da), puis serveur + client web (c19df6592 → 5e23d1866).

| Vérification | Référence (`dev`) | wt-socle |
|---|---|---|
| Le 3ᵉ appareil ne suit pas le lancement | ✘ | ✔ |
| … ne reçoit aucun `wt:state` | ✘ 20 trames | ✔ 0 |
| … `GET /group` → `null`, `GET /group/elsewhere` → la salle | ✘ | ✔ |
| … affiche « Groupe en cours sur un autre appareil » et « Rejoindre ici » | — | ✔ (client web) |
| … sa pause n'arrête pas la salle | ✘ | ✔ `wt:error not_in_group` |
| … son « quitter » ne retire personne | ✘ | ✔ 404 |
| … sa fermeture n'éjecte personne (15 s) | ✘ | ✔ |
| « Rejoindre ici » ajoute l'appareil sans retirer le premier | — | ✔ |
| Intro [auto] : pas de bouton avant « tous prêts », la salle ne saute pas sans B | ✘ / ✔ | ✔ / ✔ |
| Intro [auto] : saut commun une fois tous prêts, réaligné | ✔ 418 ms | ✔ 107 ms |
| Intro [proposer] : bouton absent tant que B charge, présent une fois tous prêts | ✘ | ✔ |
| Intro [proposer] : un clic emmène les deux après l'intro | ✘ (B laissé à 0 s) | à rejouer au calme (voir ci-dessous) |
| Appuis +30 s martelés (5 en 400 ms) : chacun compte | ✘ (+30 s) | ✔ +147 s seul, +147,7 s en séance, 0 ms d'écart |
| Affinité : séance, match en direct, « Regarder ensemble » suivi, alignement | — | ✔ 2,1 s |
| Départ commun : du lancement à < 100 ms | 5,4 s | 1,9 s |

### Chat en rafale (wt-socle 7f894807a)

| Vérification | Résultat |
|---|---|
| 25 réactions identiques en ~1,2 s | ✔ 25 envoyées, 25 reçues, UNE bulle « ×N » chez l'autre |
| 12 messages d'affilée | ✔ 10 envoyés (plafond du client, avant l'envoi), 10 reçus |
| « X est en train d'écrire… » chez l'autre | ✔ ~40 ms après la 1ʳᵉ frappe ; jamais chez soi |
| … s'éteint à l'envoi / après la dernière frappe | ✔ 3 ms / 4,1 s |
| Au repos, rien sur le réseau | ✔ 0 `wt:typing` |
| GIF | non joués (Klipy hors d'atteinte du banc) |

Défaut mineur (web, remonté) : une boîte « Invitations » reste ouverte
par-dessus le lecteur quand l'invitation a été acceptée ailleurs ; l'invitation
qu'elle montre est morte.

Sous forte charge (construction Xcode en parallèle, Jellyfin dans colima
transcodant sous le temps réel), le membre en transcodage est entré dans une
boucle de « seek dur de recalage » toutes les 1,8 s : chaque saut se pose,
puis la vidéo n'avance plus 1,6 s et la boucle re-saute. À rejouer sur Mac
calme ; si elle persiste, la boucle devrait se taire (et déclarer « je cale »)
tant qu'un saut posé n'a pas repris la lecture.

## 4. iPhone et iPad (simulateurs) — premier passage

Simulateurs « WT banc iPhone (Claude) » (iPhone 17 Pro) et « WT banc iPad
(Claude) » (iPad Pro 11 M5), iOS 26.3, app de dev PARTAGÉE du lot, JS du Metro
du banc (wt-mobile 0bf18ba25 + sonde), serveur de wt-socle. Session posée sans
geste (manifeste AsyncStorage), lecture par Hermes, navigation par le routeur
d'expo-router, gestes par l'arbre React.

| Vérification | Résultat |
|---|---|
| Les deux apps parlent au backend avec leur session | ✔ |
| L'iPad reçoit l'invitation (feuille « Invitations », « Accepter / Refuser / Plus tard ») | ✔ |
| L'iPad suit le lancement de l'iPhone jusqu'au lecteur | ✔ 556 ms |
| Départ aligné à < 100 ms | ✘ 46,8 s |
| Régime, gestes | non mesurables (gels répétés, voir défauts M1–M5) |

| # | Défaut mobile (remonté à wt-mobile avec le journal serveur) | État |
|---|---|---|
| M1 | Après le saut AUTOMATIQUE de l'intro (barrière à 40 s), aucun « prêt » des mobiles : salle gelée 60 s, puis le balayage anti-gel les marque tous deux « ne peut pas lire ». Leurs « prêt » n'ont jamais de `barrierId` | corrigé (a23e7a1e8), à rejouer |
| M2 | « Passer l'intro » affiché à l'arrivée sur le lecteur, vidéo pas encore chargée | corrigé (b63c0ee3f + a23e7a1e8), à rejouer |
| M3 | Toutes les ~5 s, « je cale » des deux mobiles sans retour « prêt » → trois gels de 60 s d'affilée | corrigé (edc785ba4), à rejouer |
| M4 | Position aberrante 1 069,5 s sur un épisode de 300 s → « épisode suivant » envoyé par les deux | cause : gels + horloge de salle relancée par le balayage (signalé à wt-socle) |
| M5 | Épisode 2 : les mobiles à 41,7 s (reprise Jellyfin personnelle) quand la salle est à 0 → interblocage, chacun affiche « l'autre met en mémoire tampon… » | corrigé (867cd3698) ; le banc garde exprès une reprise de 41,7 s chez le compte qui suit |

## Incident de nuit : veille du Mac

De 04:56 à 05:14 le Mac est passé en veille profonde (`pmset -g log` : « DarkWake
from Deep Idle »). Tout le lot a été gelé ; le passage web de 04:55 est jeté
(pics de 1,7 s, réalignements négatifs). Depuis, `run` tient un `caffeinate -s`,
et les pages datent leurs mesures à `Date.now()` (l'horloge monotone d'une page
s'arrête pendant la veille).

## 5. Ce qui reste

_À compléter en fin de nuit._
