# Banc « écran noir » (Linux)

« Comme une page sans contenu » : la fenêtre est là, la page non. Ce que le banc a établi
(10/11/2026, Bazzite, RTX, KWin virtuel — montage de `bench/gel/README.md`, page `bench/gel/page`) :

| Cas | Avant | Après |
|---|---|---|
| Le processus de rendu tombe (plantage, mémoire, tué) | dernière image FIGÉE pour toujours, plus un clic, rien au journal ; noir si rien n'avait été peint | la MÊME page rechargée aussitôt ; une 2ᵉ chute dans la minute : l'accueil ; puis 2, 5, 10, 30 s — `[rendu] le processus de rendu est tombé (…)` ; une vidéo en cours est arrêtée |
| L'import de la page est refusé par le pilote (dmabuf) | page NOIRE : 0 image, pixel `rgba(0,0,0,0)`, une ligne `[dmabuf] eglCreateImage refusé` | constaté en trois images, l'app se relance d'elle-même en peinture logicielle (OnPaint) : page affichée, 60 i/s |
| EGL sans `dma_buf_import` | page NOIRE (le journal promettait OnPaint, rien ne le faisait) | su avant de créer la page : peinte en logiciel d'emblée |
| Le processus GPU tombe une fois | Chromium le relance, l'image revient | inchangé |
| Le processus GPU tombe en boucle au lancement | « GPU process isn't usable. Goodbye. » : l'app sort, et recommence à chaque lancement | le lancement suivant part SANS GPU (`--disable-gpu`, OnPaint) : page affichée |

Le secours (`src/shell/page_rescue.h`) vaut cinq lancements, puis la voie accélérée est
retentée ; `<profil>/page-essai` est le témoin d'un lancement qui n'a pas encore montré la page,
`<profil>/page-secours.json` le secours en cours (le supprimer suffit à retenter tout de suite).

## Rejouer

L'app lancée comme dans `bench/gel/README.md`, puis :

```bash
node bench/noir/noir.mjs page  --port 9411   # la page est-elle affichée et vivante ?
node bench/noir/noir.mjs rendu --port 9411   # tue le rendu deux fois : rechargée, puis l'accueil
node bench/noir/noir.mjs gpu   --port 9411   # tue le GPU une fois
```

- **Import refusé** : lancer l'app avec `TENTACLE_DEBUG_DMABUF_REFUSE=1`, attendre la relance,
  puis `noir.mjs page`.
- **Lancement qui n'a rien montré** : tuer l'app (`kill -9`) dès que `<profil>/page-essai`
  existe, la relancer, puis `noir.mjs page` (journal : « Chromium sans GPU »).
- **L'état d'avant** : `TENTACLE_DEBUG_NO_RESCUE=1` coupe le rechargement et le secours.

Pas couvert : un pilote qui refuse VRAIMENT l'import (le refus est simulé), le GPU réellement
inutilisable au lancement (simulé par le témoin), X11/XWayland sur NVIDIA.
