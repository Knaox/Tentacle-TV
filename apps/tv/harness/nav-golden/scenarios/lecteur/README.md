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

L'approche attend la fin du démarrage (`wait:6`) puis descend sur Reprendre :
le héros tourne seul (8 s), une approche par le héros jouerait le titre du
moment.
