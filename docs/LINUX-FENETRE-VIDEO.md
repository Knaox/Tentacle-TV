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
| Interface au-dessus de mpv plein écran, sur KWin Wayland | **oui** |
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

## La réserve : X11 n'a pas pu être validé ici

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
6. libmpv livrée avec l'application.

## Reproduire

Le banc n'est pas versionné (il est jetable, et il dépend d'un écran HDR réel). Pour le
refaire : un `package.json` Electron minimal, `koffi.load("libmpv.so.2")`, les options
ci-dessus, une page transparente à carrés témoins, `spectacle -f -b -n -o` pour la capture,
et `ffmpeg -vf scale=iw/4:ih/4:flags=neighbor -f rawvideo -pix_fmt rgb24` pour compter les
pixels sans rien interpréter.
