# Scénarios de référence — lecteur (T5)

Dossier du domaine `lecteur` : ses scénarios (`<nom>.json`, à la racine de ce
dossier), leurs références (`<nom>.golden.json`, écrites par `record`, jamais à
la main) et, s'il en faut, ses jeux de données (`fixtures.mjs`). Les
sous-dossiers ne sont pas lus par le banc.

Format, jeux de données, enregistrement et vérification :
[docs/tv-navigation/banc.md](../../../../../../docs/tv-navigation/banc.md).

## Ce que couvrent les scénarios (`lecteur.json`)

Relevé du domaine : [docs/tv-navigation/lecteur.md](../../../../../../docs/tv-navigation/lecteur.md).

| Id | Ce qu'il garde |
|---|---|
| `lec-01` | entrée dans la vidéo, extinction de l'habillage, saut → / ← habillage masqué, Menu quitte (focus rendu à la carte) |
| `lec-02` | la rangée de l'habillage au clic, HAUT vers Retour par la frise, BAS vers lecture/pause, Menu masque puis quitte |
| `lec-03` | la feuille Pistes : entrée, marge-pont vers la croix, Menu rend le focus à « Pistes » |
| `lec-04` | la feuille Réglages : Menu rend le focus à « Réglages » |
| `lec-05` | le bouton ⏩ : défilement, → déplace la cible, OK valide ; rouvert, Retour annule |
| `lec-06` | maintien → (avance rapide), Retour l'annule, l'habillage revient sur lecture/pause |
| `lec-07` | la pause épingle l'habillage, Menu le masque en pause, → saute en pause, OK le rallume |
| `lec-08` | le glisser au pavé (chemin JS de RN-tvOS) ouvre le défilement, Retour l'annule |
| `lec-09` | l'ouverture en échec (aucun flux) : piège d'écran, Menu quitte |

Les décisions fines (sauts de +30/−10, badge, paliers et décompte, gardes,
couches du Retour, Android TV) ont leur banc déterministe :
`apps/tv/harness/player-trace` (traces dans `traces/`, à la milliseconde).

## Le jeu `flux-mp4` : une vraie lecture

Le faux Jellyfin ne sert aucun flux. `flux-mp4` (`fixtures.mjs`) fait de
« Orgueil et Préjugés » (Reprendre [0]) un MP4 H.264 / AAC de 10 min lu en
direct par AVPlayer, servi avec les plages d'octets. La vidéo se génère une
fois par machine :

```bash
mkdir -p ~/Library/Caches/tentacle-nav-golden/lecteur && ffmpeg -f lavfi -i "testsrc2=size=640x360:rate=24:duration=600" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=600" -c:v libx264 -profile:v main -preset veryfast -b:v 300k -g 48 -pix_fmt yuv420p -c:a aac -b:a 64k -ac 2 -movflags +faststart ~/Library/Caches/tentacle-nav-golden/lecteur/banc-600s.mp4
```

L'approche passe par l'accueil (`route: Home`, son entrée sur le héros) puis descend sur Reprendre :
le héros tourne seul (8 s), une approche par le héros jouerait le titre du
moment.

Sous charge, l'accueil peut perdre son entrée au démarrage (constat 4 de
`docs/tv-navigation/focus.md`) : le focus tombe sur le rail, et BAS mène
alors à `nav:Search` au lieu de Reprendre. Tous les scénarios partent donc
de l'approche convergente des scénarios d'accueil (`wait:1`, GAUCHE, DROITE :
du héros comme du rail, retour sur `hero:primary`), puis BAS.

Deux minuteries du lecteur courent contre les relevés : l'extinction de
l'habillage (5 s après son dernier allumage) et la reprise automatique du
défilement (5 s après le dernier geste). Or un relevé SANS focus n'est
accepté qu'après 4 s de calme (`NULL_FOCUS_QUIET_MS` du banc) : pendant un
défilement, il tombe au bord de la reprise automatique. Les défilements
(`lec-05` au bouton ⏩, `lec-06` au maintien, `lec-08` au pavé) s'ouvrent et se
ferment donc dans le même pas, sans relevé entre les gestes.

## Démarrage du lecteur d'Android TV : trois MKV

`flux-h264-ac3`, `flux-hevc-eac3` et `flux-hdr10-eac3` font du même film un MKV
1080p à 23,976 i/s (la bascule de fréquence d'affichage), son 5.1 en AC-3 ou
E-AC-3 (le passthrough), HDR10 pour le dernier — 90 s, générés une fois :

```bash
cd ~/Library/Caches/tentacle-nav-golden/lecteur
ffmpeg -f lavfi -i "testsrc2=size=1920x1080:rate=24000/1001:duration=90" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=90,aformat=channel_layouts=5.1" -c:v libx264 -preset ultrafast -tune zerolatency -b:v 6M -g 48 -pix_fmt yuv420p -c:a ac3 -b:a 384k banc-h264-ac3.mkv
ffmpeg -f lavfi -i "testsrc2=size=1920x1080:rate=24000/1001:duration=90" -f lavfi -i "sine=frequency=660:sample_rate=48000:duration=90,aformat=channel_layouts=5.1" -c:v libx265 -preset ultrafast -x265-params "keyint=48" -b:v 5M -pix_fmt yuv420p -tag:v hvc1 -c:a eac3 -b:a 384k banc-hevc-eac3.mkv
ffmpeg -f lavfi -i "testsrc2=size=1920x1080:rate=24000/1001:duration=90" -f lavfi -i "sine=frequency=880:sample_rate=48000:duration=90,aformat=channel_layouts=5.1" -c:v libx265 -preset ultrafast -pix_fmt yuv420p10le -x265-params "keyint=48:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1):max-cll=1000,400:hdr10=1" -b:v 6M -tag:v hvc1 -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc -c:a eac3 -b:a 384k banc-hdr10-eac3.mkv
```

## Jeux L4 : le coût du son décodé et des sous-titres (box faible)

`flux-l4-truehd`, `flux-l4-dts`, `flux-l4-eac3`, `flux-l4-ac3`, `flux-l4-aac`,
`flux-l4-ass` et `flux-l4-pgs` font du film une image LÉGÈRE (H.264 640×360,
décodée par l'hôte de l'émulateur) portant un son ou un sous-titre LOURD :
bruit rose (le pire cas d'un codec sans perte), ASS de 6 lignes à l'écran en
permanence (servi en WebVTT, comme Jellyfin le fait pour Android TV), PGS
dense. Le sous-titre est choisi d'office (préférences de pistes du faux
Tentacle). Fichiers générés une fois dans `lecteur/l4/` :

```bash
python3 apps/tv/harness/android-perf/lib/lite/l4media.py
```

Mesure : `lite.mjs cout run` (`docs/android-tv-lite/BANC.md`, « Le coût d'une lecture »).
