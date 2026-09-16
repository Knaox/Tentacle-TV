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
40 ms sur le web, 45 ms sur mpv (horloge à 8 Hz, extrapolée) ; hystérésis
(25 ms) pour ne pas battre ; seek dur dès 1,5 s ou après 15 s de douceur
vaine ; en pause, recalage exact dès 40 ms. Le lookahead d'un seek dur est la
latence de seek mesurée de ce lecteur (repli 0,25 s). Après une reprise
planifiée, un départ en retard de plus de 250 ms se corrige d'un seul seek.
Le pré-calage d'une barrière se fait dès 40 ms d'écart sur le web, 100 ms sur
mpv.

La boucle se tait quand : le lecteur n'a jamais été prêt ; un seek local est
en vol ; une reprise planifiée attend son instant ; un intent local est en
vol (entre une pause locale et son écho, réconcilier relancerait la lecture
sous les doigts de l'utilisateur) ; la salle m'attend dans une barrière.

## La position lue

Web : `currentTime` lu en direct sur l'élément (`timeupdate` date de 250 ms).
C'est la position du film, sans correction. Mesuré le 16 septembre 2026 au
ffprobe sur les segments de Jellyfin 10.11 : TOUS les horodatages d'un
transcodage HLS sont décalés de dix secondes par rapport à l'heure de la
playlist — le segment 0 (0 s) porte de l'audio à 10,000 s, le segment 166
(498 s) à 507,957 s — sur des conteneurs qui partent de zéro. C'est le muxeur
MPEG-TS de ffmpeg (2 × `max_delay`, Jellyfin passe `-max_delay 5000000`), un
décalage constant que hls.js absorbe dans `initPTS` (premier PTS − heure
playlist du premier fragment, dix secondes quel que soit le fragment) : le
temps de l'élément est l'heure de la playlist, donc le temps du film. mpv le
rebase de la même façon (`rebase-start-time`, sur le premier segment lu).
Une version d'un jour avait pris ces dix secondes pour un atterrissage
d'image clé et les ajoutait à `currentTime` : toute session partie ailleurs
qu'au segment 0 rapportait dix secondes de trop — un épisode de 22 min 39
« finissait » à 22 min 49, et le lecteur web se calait dix secondes derrière
le bureau à secondes affichées égales ; deux onglets web, faux du même
montant, paraissaient synchrones. Retirée le jour même. Il reste le vrai
atterrissage, mesurable seulement contre une base : une session partie du
segment 0 retient son `initPTS` comme base du média (décalage du muxeur +
base du conteneur, 677 s sur un enregistrement de diffusion), et l'écart
d'une session ultérieure à cette base se corrige (−43 ms mesurés : l'audio
coupé à une trame AAC ; une image clé plus loin chez un serveur dont l'`-ss`
ne serait pas précis). Une session neuve vise sa cible (un segment plus tôt
seulement si un atterrissage positif est connu), et le replacement / les
sauts hors de la passe restent (`hlsTimeline.ts`) : revenir en arrière dans
une session mélange en tampon deux passes ffmpeg et fige le décodeur.
mpv : `time-pos` et `audio-pts` arrivent étranglés à 8 Hz et traversent
l'IPC — le processus principal horodate chaque valeur à sa lecture dans la
file de mpv, et le transport extrapole depuis cet instant à la vitesse
courante, médiane de trois échantillons contre la gigue du pompage
(`mpvPositionClock.ts`), sauf en pause, en seek ou en buffering. En lecture,
c'est l'HORLOGE AUDIO (`audio-pts`) qui est retenue quand elle est fraîche
(`mpvClock.ts`) : `time-pos` est la position de l'image affichée, posée à sa
mise en file — elle avance par sauts d'une image et peut précéder ou suivre
ce qui sort du haut-parleur de jusqu'à 40 ms, dans un sens qui dépend de la
sortie vidéo ; `audio-pts` est l'échantillon qui sort à l'instant de la
lecture, latence de sortie déduite — la même horloge que le `currentTime` du
web. Deux clients comparés sur la même horloge n'ont plus ce biais d'une
image. À l'arrêt, `time-pos` fait foi (l'horloge audio y est figée ou périmée).

## L'atterrissage de mpv en transcodage

Mesuré le 16 septembre 2026 (mpv 0.37 sans écran depuis le conteneur, One
Piece S16E25 mkv h264, Jellyfin 10.11 + QSV) : sur un HLS Jellyfin, la
playlist annonce le segment N à N × 3 s, mais le ffmpeg relancé pour le
produire part de l'image clé voisine — une à dix secondes plus loin selon le
fichier. mpv lit les horodatages réels et rapporte honnêtement sa position ;
c'est l'atterrissage qui est faux : `--start=+500` → 501,042 s ; `seek 100
absolute` → 102,060 s ; un seek en avant hors passe (900) → 900,024 s. En
séance, un lecteur qui se cale sur une cible et atterrit une seconde trop
loin n'est jamais posé, et la boucle de dérive le renverrait au même endroit
en spirale.

Le remède est `hr-seek-demuxer-offset` : mpv recule le démuxeur de ce nombre
de secondes avant la cible, puis décode et jette les images jusqu'à elle —
son mécanisme de seek précis, que la playlist mensongère mettait en échec.
Avec douze secondes de recul, même fichier : `--start=+500` → 500,000 s ;
`seek 100 absolute` → 100,017 s (une image), en 1,3 s au lieu de 1,1. Le
recul vaut douze secondes sur un HLS (les intervalles d'images clés d'un
WEB-DL vont jusqu'à dix), zéro en lecture directe, et il est posé par
`play()` avant chaque `loadfile` ; un atterrissage encore en retard (images
clés plus rares) élargit le recul du retard mesuré plus trois secondes,
jusqu'à trente, et refait le seek une fois (`mpvSeekLanding.ts`,
`useMpvExactSeek.ts`). Tous les seeks absolus du lecteur de bureau passent
par là — barre, ±30 s, arbitre de passages, Watch Together — et l'ouverture
d'une source à une position est jugée de même.

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

Mesuré le 16 septembre 2026 : deux onglets web sur le même média (lecture
directe comme transcodage) se tiennent à l'oreille — l'utilisateur les juge
parfaitement synchrones. Web + bureau présentait un décalage audible à
secondes affichées égales : c'est ce qui a conduit à l'horloge audio de mpv
et aux seeks exacts ci-dessus, à revérifier à deux vrais clients.

Deux comptes, même média avec intro/générique, web + bureau, puis un
troisième membre : écart en régime établi (cible ≤ 40 ms en lecture
directe, ≤ 60 ms en transcodage), écart web/bureau à l'oreille (aucun écho,
les deux sur la même sortie audio), bureau en transcodage : entrée dans la
salle et seeks posés à la cible sans spirale (journaux `[WT … mpv-seek]`
« atterrissage posé »), reprise après pause (aucun recalage dur dans les
journaux), scrub rapide (une seule reprise), changement de langue côté
invité (chip « En attente », reprise alignée), coupure Wi-Fi 10 s (la salle
repart), décompte d'intro identique des deux côtés, clic et croix d'un
invité répercutés, client d'avant dans la salle.
