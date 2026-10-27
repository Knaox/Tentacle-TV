# Banc Liquid Glass — bureau macOS (lot 1.40.0)

Recette du verre natif (macOS 26, `electron-liquid-glass`) sur la VRAIE app de dev :
vrai processus principal, vrai preload, vraie CSP, vrai backend, vrai Jellyfin —
tous JETABLES. Jamais lancé par `pnpm test`. Jamais le Jellyfin réel (dev et prod
le partagent), jamais un compte réel : `Knaoxtest` et `admin` sont des comptes du
Jellyfin jetable, mots de passe générés et rangés dans `<état>/jf/` (0600).

## Mise en place (une fois)

```bash
B=/un/dossier/d-etat                     # hors du dépôt (scratchpad)
bash apps/desktop-electron/bench/liquid-glass/jellyfin.sh "$B"   # Jellyfin 10.11 :18307
bash apps/desktop-electron/bench/liquid-glass/backend.sh "$B" &  # backend du worktree :3107
pnpm --filter @tentacle-tv/desktop-electron build:web:debug      # ou build:web (mesures GPU)
pnpm --filter @tentacle-tv/desktop-electron build:ts
```

`jellyfin.sh` pose douze films aux affiches en dégradés vifs (ce que le verre
réfracte : blanc pur, noir pur, saturés), dont **Banc HDR10** (HEVC Main10, PQ,
BT.2020, 4K) et **Banc SDR** (H.264 BT.709), et la série **Écume** (2 × 3 épisodes).

## Passages

```bash
cd apps/desktop-electron/bench/liquid-glass
BANC_STATE="$B" node smoke.mjs      # profil neuf, connexion, accueil, une capture
BANC_STATE="$B" node matrix.mjs     # la matrice complète (voir plus bas)
```

Preuves : `~/Pictures/tentacle-banc-liquid-glass/<date>-<passe>/` (dossier daté et
visible ; `BANC_OUT` pour un autre). Jamais la Corbeille.

## Comment il observe

- **Profil jetable** : `CFFIXED_USER_HOME=<état>/home-<cellule>` — `--user-data-dir`
  est ignoré (`index.ts` force `userData`). Le verrou d'instance unique suit ce HOME.
- **Verrou du lot** : `mkdir …/locks/lg/electron-slot-1|2` avant, `rmdir` après ;
  arrêt par NOTRE pid (jamais `pkill -f`).
- **Page** : CDP sur `9307` (DOM, `data-liquid-glass`, interrupteur, `prefers-*`
  émulés). **Principal** : inspecteur Node sur `9407` (`nativeTheme`, relevé des
  régions natives exposé par le socle).
- **Captures** : `screencapture -l <fenêtre>` (fenêtre seule, sans ombre) ; pour le
  lecteur Apple Silicon (mpv dans SA fenêtre Metal, sous la nôtre),
  `screencapture -R` du rectangle : la composition réelle.
- **GPU** : `ioreg` (IOAccelerator, « Device Utilization % », sans sudo) à 1 Hz —
  machine ENTIÈRE, à comparer d'une cellule à l'autre dans une même passe.
  `powermetrics` (watts) exige sudo : la passe officielle sur build de production
  reste manuelle (`sudo powermetrics --samplers gpu_power -i 1000 -n 10`).
- **HDR** : `mpv_get_property` → `video-params` ET `video-target-params` (le
  COUPLE), `current-vo`, `hwdec-current`.

Arrêt : arrêter le backend par son PID (`<état>/backend.pid`), puis
`docker rm -f lg-banc-jf && docker volume rm lg-banc-jf-config lg-banc-jf-cache lg-banc-jf-media`.

## ⚠️ Captures composites et vie privée

`screencapture -R` saisit TOUT ce qui est à l'écran dans le rectangle : si la fenêtre
devient transparente (un PiP resté ouvert, un défaut de surface), les fenêtres des AUTRES
applications y paraissent. Le banc ferme le PiP par son vrai bouton avant la suite ; une
capture qui en montrerait se floute (`magick f.png -blur 0x18 f.png`) avant d'être montrée.

## Le lecteur, fenêtre ACTIVE (lg3)

⚠️ Le verre natif n'a pas le même rendu fenêtre active et inactive : sur du noir pur, 87/255
active contre 33 inactive (mesuré le 22/10). Le banc ouvre ses fenêtres SANS focus : il juge le
cas inactif, pas celui que voit l'utilisateur. `lg3/` pilote l'app tenue par `lg2/hold.mjs` :

```bash
node lg3/probe.mjs Knaoxtest play Banc Neige   # lit le clip, puis REND le premier plan (mpv active l'app)
node lg3/probe.mjs Knaoxtest pause             # en pause, les contrôles restent affichés
node lg3/probe.mjs Knaoxtest show              # fenêtre à l'écran sans l'activer (grand écran ; 120 s d'inactivité)
node lg3/probe.mjs Knaoxtest activate          # fenêtre ACTIVE (120 s d'inactivité), puis `unfront <pid>`
node lg3/probe.mjs Knaoxtest fsseq ctl|hidden  # aller-retour plein écran relevé à +150…2600 ms, sortie garantie
node lg3/tint.mjs Knaoxtest neige clear,none,-,0.5   # essai : niveau, teinte native, apparence, voile de page
node lg3/geometry.mjs Knaoxtest 900x560 1900x1040    # géométrie de l'overlay, verre allumé contre coupé (référence)
node lg3/geometry.mjs Knaoxtest resize               # redimensionnement en direct : fenêtre − 48, page, vue native
node lg3/geometry.mjs Knaoxtest fs                   # la même en plein écran (écran déverrouillé, sortie garantie)
```

- Lancer, quitter le lecteur (Échap) ou recharger la page ACTIVE l'app : rendre aussitôt le
  premier plan (`unfront <pid de l'app d'avant>`), jamais laisser le banc sous le clavier.
- `show` vise le plus grand écran : l'autre peut montrer un espace plein écran de Damien, où la
  fenêtre ne serait pas à l'écran (`onscreen: false`, capture impossible).
- Écran verrouillé (premier plan : `loginwindow`) : aucune transition plein écran ne se joue.
- Mesurer les gris en sRGB (`%[fx:mean.g]`), jamais après `-colorspace Gray` : linéaire en IM7.

## Lisibilité du lecteur (lg8)

Neuf images FIXES (blanc pur, noir pur, gris 50 %, jaune vif, rouge, bleu, pastel de dessin
animé, bruit noir/blanc, dégradé noir → blanc), lues une à une dans la fenêtre ACTIVE ; pour
chaque état (contrôles, panneau de vitesse, panneau des pistes) deux captures de la fenêtre :
pleine, puis textes, glyphes et barre rendus invisibles. Le masque des pixels qui changent est
le premier plan de chaque élément ; la capture nue, son fond (verre, voile, vidéo). Contraste
WCAG contre le fond le plus défavorable sous l'élément ; seuils : texte 4,5:1, glyphes et barre
3:1. Les éléments sont trouvés sans les classes du lecteur (nœuds texte, `<svg>`, barre :
`LG8_BAR` ou `[data-lg8-bar]`, `.lgp-scrub__fill`) ; le compteur « cache » et le bouton DEBUG
(builds instrumentés seulement) sont masqués dans les deux captures.

```bash
export BANC_STATE=$HOME/Library/Caches/tentacle-lg8-banc BANC_PORT_CDP=9321 BANC_PORT_MAIN=9421
bash lg8/clips.sh "$BANC_STATE"            # une fois, après jellyfin.sh
node lg2/hold.mjs Knaoxtest &              # l'app de la branche à juger (build:web:debug + build:ts)
node lg8/legibility.mjs Knaoxtest          # → rapport.md + mesures.json + captures
node lg8/contrast.selftest.mjs             # la mesure elle-même, hors ligne
```

`LG8_CLIPS=blanc,pastel` et `LG8_STATES=controles` pour une passe courte ; `LG8_OUT` pour le
dossier des preuves. 120 s d'inactivité avant CHAQUE clip (le lancement de mpv active l'app),
abandon du clip si Damien revient. Couleurs ramenées en sRGB avant la mesure.
