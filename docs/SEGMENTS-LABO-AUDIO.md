# Segments par l'audio des voisins de saison — relevés du labo (19-20.09.2026)

Ce document fixe ce qu'un labo de deux jours a MESURÉ sur l'audio de dix
épisodes réels, ce qui en a été retenu dans le code (`services/audio*.ts`,
`playback/audioVerdict.ts`), les pièges payés, et les pistes FERMÉES avec
chiffres — pour que personne ne les re-creuse de bonne foi. Il prolonge
`SEGMENTS-LABO-TRICKPLAY.md`, dont « La voie d'après » désignait ce substrat.

## Corpus

Re:Zero S4 E1–E4 (23:40, MKV 1,5 Go, 9 Mbit/s, AAC stéréo) ; One Piece
Egghead S23 E11–E13 (23:35, 4 Mbit/s) ; One Piece Wano S21 E100–E102 (23:35).
Vérité terrain : Intro Skipper (API Media Segments) là où il a parlé, planches
trickplay à l'œil ailleurs. Jellyfin 10.11.8.

## La méthode, et pourquoi elle marche

Un opening et un ending sont le MÊME enregistrement d'un épisode à l'autre.
Leur empreinte chromaprint (11 025 Hz, un point de 32 bits tous les 124 ms,
soit 8,08 pts/s) est donc la même suite de points, à un décalage près :

1. vote des décalages (j − i) sur les égalités exactes, par jointure de hachage
   — un vrai passage commun compte des centaines de votes, le bruit moins de
   cinq par décalage ; force brute à Hamming ≤ 6 en repli, par tranches ;
2. marche le long de la diagonale retenue, point apparié si Hamming ≤ 6 (le
   seuil d'Intro Skipper) ;
3. zones denses : fenêtre de 2 s, quatre points sur dix ; trous ≤ 3 s fusionnés.

Mesuré sur les empreintes complètes (ffmpeg `-f chromaprint`) :

| Paire | Zone commune | Vérité terrain | Densité |
|---|---|---|---|
| Re:Zero E3 × E2, têtes | 2:47→4:16 = 2:20→3:49 | OP 2:49→4:12 / 2:20→3:46 | 1,00 |
| Re:Zero E3 × E4, queues | 22:08→23:37 = 19:07→20:36 | ED 22:12→fin / 19:11→20:37 | 1,00 |
| Re:Zero E2 × E1 | rien | E1 sans OP, ED différent | — |
| Egghead E12 × E11, têtes | 0:00→1:39 | OP 0:10→1:39 (le greffon rate 10 s) | 1,00 |
| Egghead E12 × E11, queues | 21:29→23:03, puis 23:26→23:30 | ED 21:30→23:01 ; jingle d'aperçu | 1,00 / 0,84 |
| Wano E101 × E100, têtes | 0:00→1:59 | OP 0:00→2:00 | 1,00 |
| Wano E101 × E100, queues | rien | pas d'ending à Wano | — |

Moins de 30 ms par paire de fenêtres grâce à la jointure ; la force brute
n'a jamais eu à servir sur ce corpus.

## Ce qui a été retenu (constantes, aucun titre en dur)

- **Deux fenêtres, pas le fichier** : tête `clamp(20 %, 5, 10 min)`, queue
  `clamp(20 %, 6, 10 min)`. Le plancher de la queue couvre l'ending de Re:Zero
  E4, rejoué à 19:09 sur 23:40 — à 4,5 min de la fin, suivi d'un épilogue.
  Les fenêtres excluent par construction l'eyecatch de One Piece (16 s
  partagées vers 13:30-14:15, à 57 % du fichier).
- **Tête ↔ tête et queue ↔ queue, jamais en croix** : le récap de E(n)
  rejoue la queue de E(n−1), l'aperçu de E(n) la tête de E(n+1).
- **Intro** : zone la plus longue des têtes, 15 à 150 s ; marges début +1 s,
  fin −1,5 s (arriver tôt coûte une seconde d'OP, arriver tard ampute une
  scène). **Ending** : DERNIÈRE zone crédible des queues (≥ `minCredibleOutroMs`,
  ≤ 300 s), début +2 s ; moins de 45 s après elle = aperçu, la fin est étendue
  au bout ; 45 s ou plus = du contenu, et il faut que les DEUX voisins l'aient
  entendu.
- **Le témoignage** : deux voisins qui entendent le passage doivent être
  d'accord (fins à 15 s, durées à 3 s), sinon silence ; un seul voisin est
  accepté à 25 s et densité 0,8. Une zone couvrant plus de la moitié d'une
  fenêtre est le MÊME fichier : le voisin est écarté.
- Le verdict ne COMBLE que les types absents, avant les gardes de vraisemblance
  (une intro entendue passé la moitié tombe comme celle d'un greffon) et avant
  les vignettes.

## Les pièges payés, et leur parade

1. **Le transcodage progressif n'a pas de fin.** `startTimeTicks` existe, pas
   de borne : ffmpeg court jusqu'à EOF, plus 10 s après la coupure. La tête se
   lit en flux avec un budget d'octets (8 000 o/s × 1,1 + 64 Kio), puis
   `DELETE /Videos/ActiveEncodings?deviceId=…&playSessionId=…` (204) tue le
   job et son fichier temporaire.
2. **Le cache de transcodage ignore le point de départ.** Le chemin de sortie
   est un hachage de l'appareil et de la session : sans `PlaySessionId`
   unique, la seconde fenêtre reçoit le fichier partiel de la première
   (mesuré : 600 s reçues pour 420 s demandées). Un `DeviceId` fixe ne crée ni
   session ni appareil (vérifié sur `/Sessions` et `/Devices`).
3. **`fpcalc -length` vaut 120 s par défaut** : sans lui, une fenêtre de dix
   minutes est empreintée sur ses deux premières, en silence.
4. **Les E/S valent la vidéo, pas l'audio** : `-vn` n'empêche pas de LIRE les
   blocs vidéo d'un MKV. Six minutes d'un remux 4K = 2,7 Go lus par fenêtre :
   les sources à plus de 25 Mbit/s sont laissées de côté.
5. **Un faux positif serait sauté ou enchaîné tout seul** (`intro.action =
   auto`, `nextTrigger = outroStart` par défaut) : d'où les seuils, l'accord
   des voisins, et le silence au doute.

## Les pistes FERMÉES, avec les chiffres

1. **Détecteur mono-épisode par volume** (« le son devient fort et stable ») :
   1 épisode sur 7 à moins de 15 s de la vérité, erreurs de 27 à 341 s — une
   scène d'action a la même signature. Un seul épisode ne dit pas où il finit.
2. **Récaps par le son** : Wano E101 a un récap 2:00→3:00 (planches), et
   l'audio n'en retrouve RIEN dans E100 ni E102 (Hamming ≤ 6 et ≤ 10) — les
   images sont reprises, avec une narration et un nouveau lit musical.
3. **Ending non partagé** : Re:Zero E2 (dialogue sous les crédits) ne matche ni
   E1 ni E3 ; le verdict est vide, et c'est correct.
4. **L'aperçu « prochain épisode »** : son corps n'est pas reconnu (narration),
   seuls 4-5 s de jingle final le sont — trop peu pour un segment. Sa carte
   « TO BE CONTINUED » est statique (planches) : une autre voie, pas celle-ci.

## Coûts mesurés

Chemin réel (Jellyfin transcode en MP3 mono 64 kbit/s, ffmpeg empreinte) :

| | Par épisode (2 fenêtres) | Job complet (épisode + 2 voisins) |
|---|---|---|
| Octets Jellyfin → Tentacle | 5,7 Mo | 17 Mo |
| Transcodage serveur (≈ 130× temps réel) | 7 à 9 s, souffle de 2 s compris | 32 à 34 s |
| Empreinte (ffmpeg, conteneur) | < 1 s | — |
| Base | tête 2 424 pts = 9,7 Ko, queue 2 886 pts = 11,5 Ko | — |

Un épisode n'est transcodé qu'une fois : ses voisins relisent sa ligne. Une
saison de douze épisodes ≈ quatorze épisodes empreintés, ≈ 80 Mo, ≈ 2 min de
transcodage étalées sur les visionnages. Purge à 90 jours.

## Validation de bout en bout (20.09.2026, instance jetable, base de test)

- Job rejoué sur Re:Zero S4E3 : intro 2:48→4:15 (E2 seul témoin : E4 n'a pas
  d'OP), ending 22:11→fin (E4 seul témoin : E2 a un autre ED) — confirmé par 1.
  Sur Egghead E12 : intro 0:01→1:38, ending 21:31→fin (aperçu de 33 s
  absorbé) — confirmé par 2.
- Sur cette bibliothèque, Intro Skipper décrit déjà Re:Zero E2/E3 et Egghead
  E12 : la route n'y demande rien à l'audio. Re:Zero E4 (pas d'intro) et Wano
  E101 (pas d'ending) sont mis en file — et **différés** : l'utilisateur
  transcodait une vidéo sur iPhone pendant le banc. La politesse a été vue
  en vrai, pas seulement en test.
- Aucun transcodage actif ni appareil fantôme côté Jellyfin après les jobs.

## Recette du banc

Scripts éphémères (scratchpad `audiolab/`) : `fplib.mjs` (MP3 via
`/Audio/{id}/stream.mp3`, `ffmpeg -f chromaprint -fp_format raw`, vote
d'offset), `validate.ts` (le matcher du dépôt sur les empreintes complètes),
`job.ts` (le job hors file, chemin réel), `e2e.mjs` (la route, jeton d'appareil
de test). Clé admin en fichier 0600, jamais affichée, supprimé en fin de session.
