# Watch Together — le modèle de synchronisation

Ce document décrit ce que le code fait, et pourquoi. Les chiffres sont ceux
des constantes du code (`packages/shared/src/types/watchTogether.ts`, miroir
serveur `apps/backend/src/services/watchTogether/protocol.ts`) ; les mesures
de terrain restent à consigner (voir « Vérification »).

## Trois vérités

1. **Le serveur est la seule source de vérité.** Il tient l'état de chaque
   salle — `{ paused, positionTicks, stateAtServerTime }` — et le rediffuse en
   entier à chaque mutation (`epoch + 1`, les états périmés sont jetés). La
   position « vraie » se lit par extrapolation : `positionTicks + (serverNow −
   stateAtServerTime)`. Il n'y a pas de position poussée en continu.
2. **Tout membre est égal sur la lecture.** Hôte ou invité, chacun peut
   mettre en pause, reprendre, seeker, changer d'épisode. Le rôle d'hôte ne
   gouverne que la composition du groupe (inviter, expulser) et les
   RÉGLAGES de la séance : sauts de passages, enchaînement d'épisode.
3. **Le contrat vit dans `packages/shared`**, recopié tel quel dans le
   backend (`protocolMessages.ts`, tenu par `protocolMirror.test.ts`). Tout
   champ ajouté depuis la v1 est facultatif : un client d'avant (bureau de
   store en retard sur le serveur) continue de fonctionner.

## L'horloge

Chaque ping porte `t = Date.now()` ; le pong renvoie `t` et `serverTime`.
`rtt = now − t`, `offset ≈ serverTime − (t + rtt/2)` — l'hypothèse NTP d'un
trajet symétrique. On retient l'échantillon au plus PETIT aller-retour d'une
fenêtre glissante (la gigue n'ajoute que du retard, jamais de l'avance) :
premier échantillon à l'ouverture du socket, rafale de cinq à l'entrée en
séance, puis un toutes les 5 s (deux horloges dérivent de quelques ms par
minute — un offset figé au début d'un film de deux heures finirait à 100 ms).
Fenêtre de 24, rien de plus vieux que 3 min, remise à zéro sur un saut
d'horloge (`packages/api-client/src/socket/clockSync.ts`).

## La reprise planifiée

Une reprise « à la réception » repart chez chacun quand SON message arrive :
l'écart vaut la différence de latence entre membres, plus le temps de
démarrage de chaque lecteur. Le serveur pose donc `stateAtServerTime` DANS
LE FUTUR — `now + lead`, `lead = clamp(aller-retour du membre en lecture le
plus lent + 100 ms, 180 ms, 900 ms)` — avec `paused = false` : la position
n'avance pas avant cet instant. Chaque lecteur v2 se pré-cale en pause sur
la position gelée puis appelle `play()` à `T − sa latence de démarrage`
(mesurée : `play()` → première image, lissée). Un client d'avant repart à
la réception, au plus `lead` devant — d'où le plafond de 900 ms : sa boucle
ne corrige qu'à partir de 0,4 s.

La lecture demandée par l'utilisateur en séance ne joue pas localement :
`wt:play` part au serveur, qui planifie. Replis : socket fermé, horloge
inconnue, lecteur en chargement, pas de réponse en 2 s → lecture locale.
La pause reste immédiate (optimiste).

Garde d'ancre : une mutation sans position (présence, entrée, statut)
pendant la fenêtre de reprise ne touche qu'à l'epoch — re-baser à `now`
ramènerait l'ancre dans le passé.

## La barrière

Un seek appliqué « à la réception » atterrit chez chacun à un instant
différent (image clé, segment HLS). Un `wt:seek` met donc la salle en
attente sur la cible : `waitingFor` = les lecteurs v2 en lecture ; chacun
se cale en pause, sonde toutes les 100 ms s'il est POSÉ, et confirme
(`wt:buffering { buffering: false, barrierId }`) ; le dernier déclenche une
reprise planifiée. Un nouveau seek REMPLACE la barrière (nouvel id : les
« prêts » de l'ancienne sont périmés). Une lecture demandée pendant
l'attente n'a lieu qu'à la libération. Les retardataires sont lâchés à
20 s, sans être déclarés en échec. Un chargement (rechargement de source,
buffering) est une barrière à un seul membre, sans délai court (sweep
anti-gel à 60 s, avec `playbackError`).

« Posé » — web : plus de seek en vol, `readyState ≥ 3`, position à moins de
150 ms de la cible ; jamais `canplaythrough` (WebKit le tire trop tôt,
Chromium ne le retire pas sur un seek dans le tampon). mpv : ni `seeking`
ni `paused-for-cache`, position à la cible, et un `playback-restart` vu
depuis le seek — `seeking` est coalescé par le pompage à 20 ms et peut ne
jamais être vu à vrai.

## La correction de dérive

Boucle à 5 Hz (`useGroupDriftLoop`), décision pure (`driftController.ts`) :
`vitesse = 1 − dérive / 3 s`, bornée à ±5 % (au-delà, l'oreille l'entend
malgré la correction de hauteur), arrondie au demi-pour-cent ; zone morte
40 ms sur le web, 60 ms sur mpv (position extrapolée) ; hystérésis (25/30 ms)
pour ne pas battre ; seek dur dès 1,5 s ou après 15 s de douceur vaine ; en
pause, recalage exact dès 40 ms. Le lookahead d'un seek dur est la latence
de seek mesurée de ce lecteur (repli 0,25 s). Après une reprise planifiée,
un départ en retard de plus de 250 ms se corrige d'un seul seek.

La boucle se tait quand : le lecteur n'a jamais été prêt ; un seek local est
en vol ; une reprise planifiée attend son instant ; un intent local est en
vol (entre une pause locale et son écho, réconcilier relancerait la lecture
sous les doigts de l'utilisateur) ; la salle m'attend dans une barrière.

## La position lue

Web : `currentTime` lu en direct sur l'élément (`timeupdate` date de 250 ms).
mpv : `time-pos` arrive étranglé à 8 Hz et traverse l'IPC — le processus
principal horodate chaque valeur à sa lecture dans la file de mpv, et le
transport extrapole depuis cet instant à la vitesse courante, médiane de
trois échantillons contre la gigue du pompage (`mpvPositionClock.ts`), sauf
en pause, en seek ou en buffering.

## Le décompte de saut

Il n'est plus local : un lecteur qui entre dans un passage que les réglages
de l'HÔTE sautent tout seuls le PROPOSE (`wt:skipPropose`) ; le serveur arme
UN décompte pour la salle — en position de média, pas en heure murale, une
pause le fige —, dédupliqué par passage, et l'exécute par une barrière de
seek. Chacun voit le même chiffre. Un clic saute tout de suite (c'est un
seek), une croix (`wt:skipIntroDismiss`) éteint le décompte pour tous et
règle le passage ; rembobiner avant son début le redemande. Les réglages de
l'hôte sont relus à la création du groupe, à chaque transfert d'hôte et
quand l'hôte enregistre ses réglages ; un hôte sans réglages enregistrés
impose les défauts.

## Compatibilité

Un client annonce `protocolVersion: 2` dans `wt:presence`. Un client sans
version (v1) n'est jamais attendu dans une barrière (il ne saurait pas
répondre « prêt » et gèlerait la salle 60 s), reçoit les mêmes états et se
recale comme avant ; un `wt:play` venu de lui — il joue déjà — ancre la
salle là où il SERA à l'instant de reprise. Aucune TV (tvOS, Android TV,
webOS) n'a de Watch Together.

## Diagnostic

Chaque lecteur envoie une balise toutes les 5 s (`wt:tick` : position,
instant serveur de la lecture, aller-retour). Le serveur en tire l'écart de
chaque membre à la salle — à l'instant de la lecture, pas de la réception —
affiché dans le panneau (vert ≤ 50 ms, ambre ≤ 200, rouge). Journaux :
`WT_DEBUG=1` côté serveur (`[WT]`), `wtLog` côté client en développement.

## Vérification (à consigner)

Deux comptes, même média avec intro/générique, web + bureau, puis un
troisième membre : écart en régime établi (cible ≤ 40 ms en lecture
directe, ≤ 60 ms en transcodage), reprise après pause (aucun recalage dur
dans les journaux), scrub rapide (une seule reprise), changement de langue
côté invité (chip « En attente », reprise alignée), coupure Wi-Fi 10 s
(la salle repart), décompte d'intro identique des deux côtés, clic et croix
d'un invité répercutés, client d'avant dans la salle.
