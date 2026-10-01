# PrismCore 3.2.2 — copie modifiée pour Tentacle TV

Copie de [PrismCore](https://github.com/Wenzlik/PrismCore) **3.2.2**
(commit `9fa49af`), déclarée dans `TentacleTV.xcworkspace` comme paquet
local : elle **remplace** le paquet distant de même identité que le projet
Xcode référence toujours (`XCRemoteSwiftPackageReference "PrismCore"`).

## Pourquoi une copie

Des correctifs que l'amont n'a pas, chacun balisé « Modified for Tentacle TV »
dans le code.

### 1. La disposition du pont AAC (2026-09-24)

`Sources/PrismCore/Remux/AudioBridge.swift`, `negotiateLayout`.

Le pont audio de PrismCore réencode ce qu'AVPlayer ne lit pas (DTS, DTS-HD MA,
TrueHD, PCM…). Faute d'encodeur `eac3` dans le FFmpeg de MPVKit, sa cible est
l'AAC — et il gardait la disposition de la source, le 5.1 « side » que rendent
les décodeurs DTS et TrueHD. Pour toute disposition hors de ses dispositions
« normales », l'encodeur AAC de FFmpeg écrit un `program_config_element`, que
les décodeurs d'Apple refusent net : `afinfo` échoue à ouvrir le fichier,
AVPlayer répond `-16170` sur le master et `-11829` sur la forme muxée. Tout
titre aux pistes DTS ou TrueHD échouait sur Apple TV (mesuré le 2026-09-24,
Apple TV 4K, tvOS 26.6) et finissait en transcodage serveur.

Le correctif ramène l'AAC sur la disposition standard de même largeur
(5.1 « back »), que le rééchantillonneur remappe.

### 2. Les DTS des images de tête après un ré-ancrage (2026-10-01)

`Sources/PrismCore/Remux/DecodeTimestampRepair.swift` (nouveau), branché dans
`Sources/PrismCore/Remux/HLSRemuxer.swift`.

Quand AVPlayer demande un segment loin de ce qui est produit — un saut, une
reprise à une position, une relance —, le producteur se ré-ancre : seek dans
la source, muxeurs neufs. Après ce seek, libavformat rend les premiers paquets
vidéo sans DTS (sa file de réordonnancement est vide) et movenc en devine un.
Sa devinette suppose que les images qui suivent la keyframe s'affichent après
elle ; un GOP OUVERT dit le contraire : la keyframe (CRA) est suivie d'images
RASL affichées avant elle. Le DTS deviné dépasse alors le premier vrai DTS,
`av_interleaved_write_frame` refuse (-22, « non monotonically increasing
dts »), et le producteur meurt sans un mot : AVPlayer attend à jamais sur la
cible du saut, la vidéo chargée figée là où elle était.

Mesuré le 2026-10-01 sur un épisode x265 (MKV, GOP ouvert) : lecture depuis 0,
chargé jusqu'à 24,3 s, saut à 1:30 → figé à 90 s ; reprise directe à 1:30 →
figée aussi, relances comprises.

**Titres touchés** : tout HEVC ou H.264 dont une keyframe d'ancrage est suivie
d'images de tête (GOP ouvert), au premier saut hors de la fenêtre produite
qui y mène — reprise à une position et relance comprises. Le saut automatique
de l'intro y mène tout droit : sur un animé à GOP ouvert, la lecture calait
juste après le générique. Sondé le 2026-10-01 : les animés encodés x265 +
Opus d'une même source, et un film sur quatorze tirés au hasard (piste EAC3
copiée — l'audio n'y est pour rien). Les GOP fermés (keyframes IDR) ne
l'étaient pas : la devinette de movenc y tombe juste.

Le correctif retient ces paquets jusqu'au premier vrai DTS et leur rend celui
qu'une lecture continue leur aurait donné : un pas d'image en arrière par
paquet (84 508, 84 550 avant 84 592 sur l'épisode mesuré, les valeurs exactes
de la lecture continue).

### 3. L'encodeur AAC du pont, rouvert à chaque ré-ancrage (2026-10-01)

`Sources/PrismCore/Remux/AudioBridge.swift` (`reset`, `discardEncoderBacklog`)
et `Sources/PrismCore/Remux/AudioRenditionWriter.swift` (`reanchor`).

Au ré-ancrage, le pont garde ses contextes et vide leur état : l'amont tient
que l'encodeur « ne garde rien », ce qui est vrai de l'EAC3 qu'il vise, pas de
l'AAC que ce FFmpeg négocie. L'encodeur AAC de FFmpeg est à retard (1024
échantillons) : il garde deux paquets de l'ancienne position et les rend aux
envois suivants, horodatés là où le producteur était. Et il ne sait pas se
vider sur place (pas de `AV_CODEC_CAP_ENCODER_FLUSH`).

Mesuré le 2026-10-01 sur une piste Opus pontée : saut en avant, le segment
audio ré-ancré s'ouvrait 64 s trop tôt (un premier échantillon de 64 s) ; saut
en ARRIÈRE (10:00 → 3:20), le muxeur refusait le deuxième paquet (-22) et le
producteur mourait — AVPlayer figé sur la cible.

**Titres touchés** : tout titre à audio ponté (Opus, DTS, DTS-HD, TrueHD,
PCM… → AAC), au premier saut en arrière hors de la fenêtre produite, et un
segment audio faux à chaque saut en avant.

Le correctif rouvre l'encodeur, mêmes paramètres, quand il garde des trames et
ne sait pas se vider : un `avcodec_open2` par ré-ancrage ; décodeur,
rééchantillonneur et FIFO restent.

### 4. Une seule ligne de temps par piste, quel que soit le muxeur (2026-10-01)

`Sources/PrismCore/Remux/FragmentTimeline.swift` (nouveau), branché dans
`FMP4SegmentWriter.swift`, `HLSRemuxer.swift` (`reanchor`) et
`AudioRenditionWriter.swift` (`reanchor`, `writeInitSegment`).

movenc place un fragment à `tfdt = dts − start_dts`. Le premier muxeur d'une
session prend `start_dts` de son premier paquet, et le segment d'init qu'il
écrit porte la liste d'édition assortie (la vidéo qui démarre deux images dans
son décalage de composition : `media_time` 83 ms ; une piste Opus qui démarre à
153 ms : une édition vide de 138 ms). C'est cet init qu'AVPlayer garde. Un
muxeur ré-ancré, lui, est ouvert en `frag_discont`, et movenc prend alors
`start_dts = dts − pts` de SON premier paquet : ses fragments ne sont plus là
où le premier muxeur les aurait mis, et la liste d'édition servie ne compense
plus.

Mesuré le 2026-10-01 sur un épisode x265 à piste Opus : après chaque saut,
l'audio jouait 138 ms en retard, et la vidéo encore 0 à 84 ms selon le
décalage de composition de la keyframe d'ancrage. Le segment d'init d'un rendu
audio était en outre réécrit à chaque ré-ancrage, si bien que la synchro
dépendait de l'instant où AVPlayer l'avait chargé.

**Titres touchés** : tout titre dont une piste ne démarre pas à 0 (l'audio Opus
des animés, avec son pré-saut) ou dont la keyframe d'ancrage a un décalage de
composition différent de celui du début (GOP ouvert), après tout saut lointain
ou toute reprise. La plupart des titres (pistes à 0, GOP fermés) n'avaient pas
d'écart mesurable.

Le correctif fait hériter chaque muxeur ré-ancré de l'origine du précédent :
il recale ses paquets dessus (`dts − origine`) sans liste d'édition, et movenc
écrit exactement le `tfdt` du premier muxeur. Le segment d'init d'un rendu
audio n'est plus réécrit (premier écrit, comme pour la vidéo). Mesuré : le
segment 10 ré-ancré a les horodatages de la production continue, à 2 ms
près (l'arrondi du DTS reconstruit de sa keyframe).

## Ce qui est repris, ce qui ne l'est pas

`Package.swift` (réduit à la bibliothèque), `Sources/PrismCore`, `LICENSE`,
`NOTICE.md`. Les tests, le fuzzer et les scripts restent en amont.

## Licence

PrismCore est sous LGPL-2.1 ou ultérieure, avec une exception pour les
boutiques d'applications (voir `LICENSE`). L'exception couvre l'*usage* de la
bibliothèque ; une version modifiée reste soumise à la LGPL et ses
modifications doivent être publiées : c'est l'objet de ce dossier, dans un
dépôt public.

## Retirer la copie

Quand l'amont a corrigé tout ce qui est listé plus haut : supprimer ce dossier
et la ligne `group:Vendor/PrismCore` de
`TentacleTV.xcworkspace/contents.xcworkspacedata`. Le projet retombe alors sur
le paquet distant (règle « jusqu'à la prochaine majeure » depuis 3.2.0).

Pour une montée de version en attendant : recopier `Sources/PrismCore` de la
nouvelle version, réappliquer les blocs balisés et reprendre les fichiers
nouveaux, rebâtir, puis rejouer sur l'Apple TV (banc
`apps/tv/harness/atv-remote`) un titre en DTS seul, un titre à GOP ouvert
repris au milieu puis sauté loin en avant et en arrière, et les mêmes sauts sur
un titre à audio ponté.
