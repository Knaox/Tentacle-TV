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
