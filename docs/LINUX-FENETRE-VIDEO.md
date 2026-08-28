# Linux — la fenêtre vidéo, et ce qu'elle décide

Relevé de faisabilité mené AVANT d'écrire la coquille Electron pour Linux, le 25.08.2026.
Il tranche trois questions dont dépend toute l'architecture, et dont la documentation ne
donne pas la réponse. Chacune a été mesurée, pas supposée.

## Le problème, en une phrase

Sous Tauri, mpv dessinait DANS notre fenêtre (Render API dans un `GtkGLArea`, la webview
transparente composée par-dessus par GTK). Electron n'offre aucun équivalent : il faut donc
passer au montage de Windows et de macOS — **mpv ouvre sa propre fenêtre, on la cale sous la
nôtre, et la page cesse de peindre son fond**. Reste à savoir si Linux le supporte, et à
quel prix.

Deux vérités s'y opposent :

1. **X11 n'aura jamais de HDR.** X.Org l'a annoncé, il n'y a pas de protocole et il n'y en
   aura pas. Le HDR sous Linux passe par `wp-color-management-v1`, un protocole **Wayland**.
2. **Sur Wayland, un client ne place pas ses fenêtres.** Le protocole ne l'autorise pas.
   Une fenêtre vidéo ne peut donc être calée sur la nôtre qu'en **plein écran**, où la
   position ne se discute pas.

## Poste de mesure

Bazzite (Fedora 44), KDE Plasma 6.7.4 / KWin 6.7.4, session Wayland.
RTX 5090, pilote NVIDIA open 610.57.04. mpv 0.41.0 (`mpv-libs` de Fedora).
Écran DP-4 : 3840×2160 @ 240 Hz, **HDR activé**, pic 1015 nits (surchargé à 980),
`Wide Color Gamut: enabled`. Trois écrans, bureau global 9984×4096.
Electron 43.2.0, koffi 3.1.2.

Protocoles annoncés par KWin : `wp_color_manager_v1`, `wp_color_representation_manager_v1`,
`zwp_idle_inhibit_manager_v1`. Extensions Vulkan présentes : `VK_EXT_swapchain_colorspace`,
`VK_EXT_hdr_metadata`.

## Méthode

Un banc jetable : un processus Electron qui charge libmpv **par koffi dans son processus
principal** (pas de sous-processus mpv, pas d'addon compilé), ouvre une fenêtre transparente
plein écran portant deux carrés témoins pleins (vert, bleu), et prend lui-même une capture
de l'écran entier. Le comptage des pixels tranche sans avoir à regarder :

- du **rouge** (la vidéo mpv) → notre fenêtre est transparente ET mpv est dessous
- du **vert/bleu** → notre contenu est bien AU-DESSUS
- du **noir** partout → la transparence a échoué

Le carré témoin fait 240×240 points logiques ; à l'échelle 2 de l'écran et après réduction
d'un facteur 4 pour l'analyse, il doit peser 14 400 px. Mesuré : 14 572. La correspondance
est ce qui fait la preuve — un carré partiellement masqué se verrait au compte.

## Résultats

| Question | Verdict |
|---|---|
| libmpv chargée par koffi depuis le processus principal | **oui** — `mpv_initialize -> 0` |
| `setlocale(LC_NUMERIC, "C")` par koffi sur la libc | **oui**, indispensable (cf. plus bas) |
| Fenêtre Electron `transparent: true` sur Wayland | **oui** |
| Interface au-dessus de mpv plein écran, sur KWin Wayland | **oui, si remappée en dernier** — voir l'empilement multi-écrans |
| mpv `fullscreen=yes` + `focus-on=never` | **oui**, mpv ne prend jamais le focus |
| HDR réel transmis à l'écran | **oui** — détail ci-dessous |
| Electron sous XWayland (`--ozone-platform=x11`) sur CE poste | **non** — voir la réserve |
| libmpv de la distribution suffisante | **non** — pas de décodeur HEVC |

### Le HDR passe, et le rendu l'écrit

Fichier PQ / bt.2020, `vo=gpu-next`, `gpu-api=vulkan`, `gpu-context=waylandvk`,
`target-colorspace-hint=yes` :

```
[vo/gpu-next/wayland] Compositor supports setting mastering display primaries.
[vo/gpu-next/wayland] target: min_luma=0.005, max_luma=980, max_cll=980, max_fall=265
[vo/gpu-next/wayland] Setting preferred transfer to PQ for HDR output.
[vo/gpu-next] reconfig to 1920x1080 yuv420p10 bt.2020-ncl/bt.2020/bt.1886/limited
[vo/gpu-next/libplacebo] Picked surface configuration 7:
        VK_FORMAT_A2B10G10R10_UNORM_PACK32 + VK_COLOR_SPACE_HDR10_ST2084_EXT
```

Les 980 nits lus par mpv sont exactement ceux que `kscreen-doctor -o` déclare pour l'écran :
le compositeur et le rendu se parlent réellement.

⚠️ **Le témoin qui vaut, et celui qui ment.** Comme sur macOS, `video-params/gamma` décrit ce
que mpv **calcule** — il vaut `bt.1886` ici, pour un film qui sort en PQ. Le seul témoin qui
dit ce qui est POSÉ sur l'écran est **`video-target-params`** :

```
video-target-params/gamma     = pq
video-target-params/primaries = bt.2020
video-target-params/sig-peak  = 3.813229     (980 nits / 257 nits de référence)
current-vo                    = gpu-next
```

`sig-peak` est l'équivalent Linux du headroom EDR de macOS : c'est la plage réellement
accordée, pas la capacité de l'écran. C'est cette propriété que le panneau de diagnostic
doit afficher.

À noter, parce que ça surprend : le swapchain Vulkan reste en `SRGB_NONLINEAR` jusqu'au
`reconfig`, et bascule en `HDR10_ST2084` seulement quand la vraie vidéo arrive. C'est la
raison d'être de `force-window=no` — la même que sur macOS, où une couche Metal née en sRGB
ne se voit jamais accorder de headroom ensuite.

### Ce que la locale casse

`mpv_create` échoue si `LC_NUMERIC` n'est pas `C` : libmpv analyse ses nombres avec
`strtod`, et une locale française lit `0.5` comme `0`. Electron initialise GTK, qui pose la
locale de l'environnement. L'appel koffi sur `libc.so.6` est donc obligatoire **avant**
`mpv_create`, exactement comme le faisait `main.rs` sous Tauri.

### La libmpv de la distribution ne suffit pas

Sur un fichier HEVC, la `mpv-libs` de Fedora 44 rend :

```
[vd] (no decoders)
[vd] Failed to initialize a decoder for codec 'hevc'.
```

Le paquet est bâti contre un FFmpeg amputé des codecs brevetés. Un client Jellyfin sans HEVC
ne lit pas la moitié d'une médiathèque. **C'est la justification, mesurée, de la décision de
livrer notre propre libmpv** — LGPL, comme sur macOS — plutôt que de dépendre du système.

### L'empilement multi-écrans : deux gestes, chacun mesuré seul (27.08.2026)

Sur un poste à trois écrans, deux questions distinctes décident de ce que voit
l'utilisateur : **sur quel écran** la fenêtre de mpv naît-elle, et **qui est
devant** quand les deux fenêtres partagent le même écran. Les mesures
précédentes mélangeaient les remèdes ; celles-ci isolent chaque geste, avec un
comptage **par écran** (`zones.mjs`) — le comptage global comptait le bureau
(un navigateur ouvert sur le Samsung pèse 0,5 % de rouge) et surtout ne
distinguait pas deux écrans de même définition.

Disposition : DP-3 Dell 1440p portrait en (0,0) ; DP-4 ASUS 4K à l'échelle 2
(celui qui porte la fenêtre Electron) ; DP-2 Samsung 1080p à l'échelle 1.
Clip `rouge.mp4`, repères HTML vert/bleu de 240×240 points dans notre fenêtre.

| Variante (montage identique, gestes isolés) | mpv finit sur | rouge/vert/bleu sur l'ASUS | Verdict |
|---|---|---|---|
| témoin — visée par bounds d'`attach()` | **Dell** (letterbox 31,6 % du Dell) | 0 / 2,8 / 2,8 % | mauvais écran |
| re-visée tardive (après `file-loaded`) | **Dell**, identique au témoin | 0 / 2,8 / 2,8 % | **sans aucun effet** |
| visée MESURÉE avant `loadfile` | **ASUS** | **100** / 0 / 0 % | bon écran, mais mpv DEVANT |
| re-mappage seul (hide/show/plein écran/focus) | **Dell** | 0 / 2,8 / 2,8 % | inutile sans cible |
| **visée avant `loadfile` + re-mappage après `file-loaded`** | **ASUS** | **94,4 / 2,8 / 2,8 %** | complet **sur bureau au repos** — voir la suite |

94,4 + 2,8 + 2,8 = 100,0 : l'écran se partage exactement entre la vidéo, vue
au travers de notre fenêtre transparente, et les deux repères posés dessus.

**Deux illusions dissipées au passage.**

1. Les « 20,29 % » du relevé précédent valaient « un écran 3840×2160 entier » —
   or l'ASUS et le Samsung pèsent **la même aire** dans la capture. Les runs
   « gagnants » d'alors avaient mpv plein écran sur le *Samsung*, où la visée
   par bounds (tributaire du curseur au lancement) l'avait envoyé **à la
   naissance**. La « re-visée qui fait rejoindre mpv » n'a jamais existé :
   rejouée seule, elle ne déplace rien. `fs-screen-name` n'est lu qu'à
   l'ENTRÉE en plein écran de mpv — après, c'est trop tard.
2. Les « 7,30 % » du témoin étaient la vidéo plein écran **letterboxée sur le
   Dell portrait** : 1152×648 points sur 1152×2048, soit 31,6 % de cet
   écran-là — et non « un peu de vidéo » sur le bon.

**Ce que ce relevé fixe.** `fs-screen-name` doit être écrit **avant le premier
`loadfile`**, avec l'écran identifié par le trio
`innerWidth`/`innerHeight`/`devicePixelRatio` mesuré par la page une fois la
fenêtre mappée en plein écran — 202-203 ms de stabilisation mesurés, sur les
trois runs. La visée par `getBounds()` est fausse par construction sur Wayland
et disparaît.

#### La suite, le même jour : le re-mappage meurt dès que l'utilisateur vit

Rejoué dans l'application réelle pendant que l'utilisateur se servait de la
machine, le re-mappage a produit l'inverse du banc, et le relevé de l'ordre
d'empilement de KWin (script D-Bus `Scripting`, couches lues sur pièce) dit
pourquoi :

```
tentacle-tv | sortie=DP-2 | pleinEcran=false | couche=2   notre fenêtre : Samsung, FENÊTRÉE
mpv         | sortie=DP-4 | pleinEcran=true  | couche=5   seul sur l'ASUS, couche « plein écran actif »
```

Le `hide()` DONNE l'activation à mpv (la fenêtre active disparue, KWin active
la suivante — `focus-on=never` n'empêche que mpv de la *demander*) ; le
`show()` replace la fenêtre sur l'écran où l'utilisateur s'active ; le
`focus()` est refusé (anti-vol de focus). Le banc, lui, tournait sur un bureau
au repos : focus accordé, replacement au même endroit. Deux remèdes de plus,
mesurés morts dans la foulée :

| Remède | Relevé | Verdict |
|---|---|---|
| `setAlwaysOnTop(true)` (couches) | Electron répond `true`, la fenêtre reste **couche 2** | inerte sur Wayland |
| `app.focus({steal:true})` après `file-loaded` | mpv reste couche 5, repères 0 % | refusé sans geste utilisateur frais |
| **activer notre fenêtre** (script KWin, l'équivalent d'un clic) | **mpv retombe couche 2, nous couche 5 — 94,4 / 2,8 / 2,8 %** | **c'est l'activation qui décide, à elle seule** |

**La règle, mesurée : la fenêtre plein écran ACTIVE est promue (couche 5),
l'autre retombe (couche 2).** Aucun geste de fenêtre ne contourne ça — et il
n'y a rien à contourner : il suffit d'être la fenêtre active. D'où le montage
retenu : (1) visée mesurée avant `loadfile` ; (2) une demande de focus 300 ms
après `file-loaded` — la fenêtre de mpv doit être née, sinon elle arrive après
nous et reprend le dessus. Portée par le jeton du clic « lecture », la demande
est honorée ; lancée sans geste utilisateur (reprise automatique), elle peut
être refusée et l'interface reste derrière **jusqu'à la première activation
venue** — clic, alt-tab — qui remet tout en ordre. Le « oui » de la ligne
« interface au-dessus » du tableau des résultats vaut à cette condition-là.

## X11, validé — dans un serveur X imbriqué

La première tentative avait échoué et la conclusion était prématurée : voir la
réserve plus bas. Un serveur X **imbriqué** (`Xephyr :5`) avec `openbox` et
`picom` donne un vrai environnement X11 depuis une session Wayland, et le
montage y a été éprouvé de bout en bout — vraie fenêtre Electron, vraie fenêtre
mpv, vrai fichier vidéo.

| Mesure | Résultat |
|---|---|
| Fenêtre de mpv trouvée par `_NET_CLIENT_LIST` | `WM_CLASS = "mpvk", "mpv"`, même PID que nous |
| Numéro de notre fenêtre (`getNativeWindowHandle`) | 4 octets, XID réel — `1` sur Wayland, donc inutilisable |
| Calage sur la zone client | au pixel : 900×532+120+118 |
| Suivi d'un déplacement + redimensionnement | 1000×572+300+228, vidéo suivie |
| Vidéo visible sous le repère HTML | 36,2 % de l'écran pour une fenêtre qui en occupe 39,7 % — l'écart EST le repère |

⚠️ **Un compositeur est nécessaire, et c'est la découverte qui compte.** Mêmes
fenêtres, même film, seul le compositeur change :

```
openbox seul      vidéo visible sur  0,0 % de l'écran, noir sur 92,7 %
openbox + picom   vidéo visible sur 92,7 % de l'écran, noir sur  0,0 %
```

Sans composition, X11 ne mélange pas le canal alpha : notre fenêtre transparente
peint du noir opaque et masque la vidéo. Tous les bureaux modernes composent
(KWin, Mutter, Xfwm, Cinnamon) ; un gestionnaire de fenêtres nu, non.

## ⚠️ Le backend X11 de mpv est GPL — et sans lui, aucune image

Découvert en compilant la chaîne. `meson` refuse net :

```
ERROR: Feature x11 cannot be enabled: the build is not GPL!
```

Le code X11 de mpv vient de MPlayer et n'est pas relicenciable. **Une libmpv
LGPL n'a donc AUCUNE sortie vidéo sous X11.** Sur macOS la question ne se posait
pas — il n'y a pas de X11 — mais ici, livrer une chaîne LGPL reviendrait à
n'afficher strictement rien pour tous les utilisateurs restés sur X11.

mpv est donc bâti en **GPL** pour Linux, FFmpeg restant en LGPL (ni x264 ni
x265 : ce sont des encodeurs). Le prix est nul du côté de la distribution —
Linux n'a pas de store à satisfaire, MIT et GPL sont compatibles, la recette
est publiée dans le dépôt et les sources de mpv et FFmpeg sont publiques. La
contrainte qui a fait retirer VLC de l'App Store ne concerne qu'Apple.

## La réserve initiale : XWayland, sur ce poste

Sous `--ozone-platform=x11`, le processus GPU de Chromium meurt en boucle :

```
MESA-LOADER: failed to open dri: /usr/lib64/gbm/dri_gbm.so: Permission non accordée
GPU process exited unexpectedly: exit_code=139
```

Testé et écarté : la transparence (le plantage a lieu aussi en fenêtre opaque), la
coexistence avec mpv (il a lieu aussi sans mpv), et le bac à sable GPU
(`--disable-gpu-sandbox` n'y change rien). En rendu logiciel le processus ne meurt plus,
mais la fenêtre ne s'affiche toujours pas.

Le défaut est donc **propre à ce poste** — Bazzite est immuable et sous SELinux, et le refus
porte sur un objet de Mesa — et il concerne XWayland, pas une vraie session X11. Il ne dit
rien de la validité du montage sur X11.

**Conséquence sur le plan** : le chemin X11 s'écrit quand même (beaucoup d'utilisateurs y
sont), sur le modèle exact de `video/win32.ts`, mais **Wayland devient le chemin principal
et le mieux éprouvé**. La validation X11 se fera sur une vraie session X11, en machine
virtuelle ou sur un autre poste, avant la livraison.

## Ce que ce relevé fixe pour la suite

1. Montage retenu : **fenêtre mpv sous une fenêtre Electron transparente**. Pas de Render
   API, pas de surimpression dessinée dans mpv.
2. Sur Wayland : les deux fenêtres en plein écran, `focus-on=never`, aucun calage manuel.
3. Sur X11 : calage et empilement par libX11, à l'image de `win32.ts`.
4. Témoin HDR : `video-target-params/gamma` et `sig-peak`, jamais `video-params`.
5. `setlocale(LC_NUMERIC, "C")` avant `mpv_create`, sans exception.
6. libmpv livrée avec l'application, mpv bâti en **GPL** (X11), FFmpeg en LGPL.
7. Sous X11, un compositeur est requis — à dire dans la documentation, pas à
   supposer.

## Reproduire

Le banc n'est pas versionné (il est jetable, et il dépend d'un écran HDR réel). Pour le
refaire : un `package.json` Electron minimal, `koffi.load("libmpv.so.2")`, les options
ci-dessus, une page transparente à carrés témoins, `spectacle -f -b -n -o` pour la capture,
et `ffmpeg -vf scale=iw/4:ih/4:flags=neighbor -f rawvideo -pix_fmt rgb24` pour compter les
pixels sans rien interpréter.

## Le verdict HDR réel — TRANSMIS (28.08.2026)

Conditions : même poste, KDE 6.7.4 Wayland, HDR **activé** dans KDE sur l'ASUS
XG27UCDMG (DP-4, 3840x2160@240) — pic 1015 nits plafonné à 980, blanc SDR 260 nits,
Wide Color Gamut actif (`kscreen-doctor -o`). Les deux autres écrans sont SDR.

### Le barrage sur la route : FFmpeg sans TLS

Premier essai sur un film de la médiathèque (réseau, https) : `start-file` →
`end-file (raison 4)`, deux fois, puis bascule de secours. Sonde sur la libmpv
livrée : `https` → « No protocol handler found … disabled at compile-time »,
`MPV_ERROR_LOADING_FAILED (-13)` ; `http` → réponse HTTP du serveur (le réseau
existe, seul TLS manque). **Le seul test réel d'avant était un fichier local.**
Correctif : `--enable-gnutls`, en DYNAMIQUE sur la gnutls du système — SONAME
`libgnutls.so.30` identique sur toutes les distributions (libssl diverge), et le
magasin de certificats reste celui de la distribution. Vérifié : audit NEEDED
propre, 0 symbole `av_` exporté, https ouvert contre le serveur Jellyfin réel.
Découvert au passage : le lecteur web de secours ne peut PAS lire un média
réseau depuis la coquille — `PlaybackInfo`/`ActiveEncodings` bloqués par CORS
depuis l'origine `tentacle://app` (fiche dédiée créée).

### La mesure, dans l'application réelle

Film HDR 4K (HEVC main10, PQ) de la médiathèque, lecture directe réseau :

```
[video] mpv visera DP-4 (ASUSTek COMPUTER INC XG27UCDMG)
[video] mpv → file-loaded
[hdr] contenu pq → sortie pq/bt.2020 · pic 3.81×
```

Panneau F9 (capture `~/.cache/tentacle-bench-linux/capture-panneau2.png`) :
« HDR : RÉEL — pq / bt.2020, pic 3.813229, couche en plage étendue », flux
RÉSEAU 5,6 Mo/s en lecture directe, décodage matériel Vulkan, 23.976 → écran
240 Hz, 0 image perdue, première image en 1,06 s. Le pic se lit à sa source :
`sig-peak = 3.813 ≈ 980 nits (plafond KDE) / 260 nits (blanc SDR KDE)`.

### La contre-mesure — le piège vérifié en vrai

Sur l'écran laissé en HDR, un clip SDR sort LUI AUSSI en PQ (banc
`hdr-couple.py`, options exactes de l'app) : `rouge.mp4` (bt.1886/bt.709) →
sortie `pq/bt.2020 · sig-peak 3.813`. Le verdict qui ne lit que la sortie
mentirait ; celui du COUPLE dit « SDR converti » et ne porte aucun verdict
(`transmissionHdr() = null`). `hdrpq.mp4` → `pq → pq/bt.2020` : transmis.

### Leçon d'empilement au passage

Une lecture SANS geste (reprise automatique) laisse l'overlay derrière la
fenêtre mpv — connu — et tout ce que la page affiche alors se joue hors de
toute vue : l'avis « première fois » du plein écran s'y est consommé invisible.
D'où la garde `document.hasFocus()` sur cet avis. L'activation par script KWin
(`activate-tentacle.js`, classe `tentacle-tv`) repasse l'overlay devant — la
règle des couches (« la fenêtre plein écran ACTIVE est promue ») rejouée en
sens inverse, pile à l'appui.

## Le fenêtré Wayland — la colle KWin (28.08.2026, nuit)

La consigne utilisateur a rouvert l'arbitrage : « la lecture doit suivre la
fenêtre, comme sur Windows — au pire on sacrifie le HDR en fenêtré ». Un client
Wayland ne place pas ses fenêtres, mais le COMPOSITEUR fait ce qu'il veut, et
KWin expose une API de script publique (`org.kde.KWin /Scripting`, D-Bus).

### Le moteur JS de KWin ne sait PAS écrire la géométrie — le déclaratif, si

Mesuré pas à pas sur KWin 6.7.4, contre-lecture indépendante à chaque essai :

| Écriture de `frameGeometry` depuis un script JS (D-Bus) | Résultat |
|---|---|
| objet nu `{x,y,width,height}` | ignorée EN SILENCE |
| `Qt.rect(...)` | `ReferenceError: Qt is not defined` |
| copie mutée puis réassignée | la copie est IMMUABLE (`g.x` ne change pas) |
| assignation même-type (`b.frameGeometry = h.frameGeometry`) | ignorée en silence |
| chaîne | `Cannot assign QString to KWin::RectF` — le type maison, inconstructible |

Le moteur DÉCLARATIF (QML, `loadDeclarativeScript`) : `Workspace` (majuscule,
wrapper différent — `windows` est une propriété, pas `windowList()`),
`Qt.rect` converti, écriture EFFECTIVE (fenêtre déplacée, contre-lue), et
`Workspace.raiseWindow` présent. Trois pièges mesurés : le cache QML par
CHEMIN (recharger un fichier modifié sert l'ancien code → hachage du contenu
dans le nom), l'écriture ASYNCHRONE (la relire aussitôt rend l'ancienne
valeur), et la réponse gdbus typée (`(int32 7,)` → le DERNIER nombre fait foi).

### La colle, mesurée au banc puis dans l'application

Le gabarit (`linux/kwinGlue.ts`) apparie par PID (libmpv vit dans notre
processus : les deux fenêtres portent le même), copie la géométrie de l'hôte
vers mpv sur `frameGeometryChanged`, tient la paire par
`raiseWindow(video)` + `raiseWindow(hote)` sans toucher au focus, rend
l'activation à l'hôte quand le compositeur active la fenêtre mpv naissante, et
habille mpv (`noBorder`, `skipTaskbar`, `skipSwitcher`). Côté mpv, la saveur
collée pose `fullscreen=no` (jamais promue couche 5) et `keepaspect-window=no`
(mesuré au banc : sinon mpv rogne sa fenêtre au ratio du clip).

Dans l'app réelle (film 4K HEVC PQ, réseau, lecture directe) :
- lecture lancée FENÊTRÉE : mpv collé exactement (1152x828), ordre
  `mpv < tentacle-tv`, hôte actif ;
- déplacement/redimensionnement : suivi au pixel (1250,620 1200x700) ;
- plein écran (hôte) : les deux à 1920x1080, hôte couche 5, mpv juste
  dessous ; SORTIE : retour exact à l'état d'avant ;
- **HDR fenêtré : `contenu pq → sortie pq/bt.2020 · pic 3.81×` DANS une
  fenêtre de 1200x700** — KWin sert le PQ aux surfaces fenêtrées, rien n'est
  sacrifié. Captures : `app-colle-{1,2,3}.png`.

### La frontière, assumée

La colle demande l'API de script de KWin : **KDE Plasma seulement**. Ailleurs
sous Wayland (GNOME, wlroots), `surfaceWayland.ts` — plein écran forcé —
reste le montage, avec l'avis pédagogique. X11 inchangé. La détection
(`detecterFenetrage`, un ping D-Bus avant la fenêtre) choisit seule.
