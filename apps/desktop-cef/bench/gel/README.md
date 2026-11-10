# Banc « gel au clic » (Linux, Wayland)

Ce que Damien voyait : l'app qui ne répond plus au premier clic, par exemple sur la barre de
navigation. Ce que le banc a établi (10/11/2026, Bazzite, RTX, KWin virtuel) :

- **Ce n'est pas le fil principal.** Afficher puis retirer la bulle d'aide d'un bouton coûtait
  quelques millisecondes ; aucune étape de la boucle ne dépassait 13 ms.
- **C'est l'affichage qui mourait.** La bulle vivait dans une fenêtre de SDL dessinée par un
  `SDL_Renderer`, sur l'EGLDisplay du compositeur. Le clic la retirait ; SDL détruisait sa
  dernière fenêtre GL et appelait `eglTerminate` : la page tournait, recevait le clic, et plus
  AUCUNE image n'était présentée. Il fallait 500 ms de survol d'un `title=` — d'où « parfois ».

| | clic reçu | images présentées en 0,5 s après le clic | fil principal, au pire |
|---|---|---|---|
| avant 9a99daaf6 (bulle SDL, sans ceinture) | oui | **0** | 10 ms |
| bulle SDL + ceinture (9a99daaf6) | oui | 30 | 13 ms |
| bulle dans le compositeur (`overlay_linux.h`) | oui | 30 | 5 ms (afficher 2,8 ms, retirer 0,01 ms) |

Depuis, la bulle et la vignette du glisser-déposer sont des images posées par-dessus la page dans
NOTRE contexte GL : ni fenêtre, ni contexte, ni shader créés ou détruits sur le chemin d'un clic.

## Rejouer

Un vrai pointeur Wayland est nécessaire (CDP ne montre jamais de bulle) : un KWin VIRTUEL, à part
de la session, et le périphérique factice de KWin.

```bash
bench/gel/kwin.sh start                                   # KWin virtuel (socket wl-tentacle-banc)
bench/gel/build-fakeinput.sh ~/.cache/tentacle-test/cef-banc/fakeinput
# l'app, dans ce KWin, sur la page du banc (son coupé, profil à part) :
WAYLAND_DISPLAY=wl-tentacle-banc DBUS_SESSION_BUS_ADDRESS="$(cat ~/.cache/tentacle-test/cef-banc/run/dbus-addr)" \
  TENTACLE_DEBUG_NAVIGATEUR=1 TENTACLE_MUTE=1 <build>/app/tentacle --url=tentacle://app/ \
  --web-root=$PWD/bench/gel/page --profile=<dossier> --user-data=<dossier> --devtools-port=9411 --mute
WAYLAND_DISPLAY=wl-tentacle-banc FAKEINPUT=~/.cache/tentacle-test/cef-banc/fakeinput/fakeinput \
  node bench/gel/gel.mjs --port 9411 --rounds 5
bench/gel/kwin.sh stop
```

Le banc sort en erreur si un clic se perd, si moins de cinq images sont présentées dans la
demi-seconde qui suit, ou si une étape de la boucle retient le fil 50 ms. `shell.debug.stalls`
(toujours là) et la ligne `[fil] fil principal retenu … ms — …` du journal disent, sur une vraie
machine, quelle étape a tenu la boucle.
