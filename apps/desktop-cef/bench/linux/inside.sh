#!/usr/bin/env bash
# Dans le conteneur (bench/linux/run.sh) : démarre le compositeur demandé, puis l'app par le
# lanceur (pnpm dev:cef sans le build web), son coupé, sans voler le focus, DevTools 9427.
#   inside.sh mutter|kwin|sway|x11 [options de l'app…]
#   inside.sh --shot <fichier.png>      capture de l'écran (sway : grim ; x11 : import)
set -u
mkdir -p /tmp/banc
export XDG_RUNTIME_DIR=/tmp/xdg HOME=/tmp/home
mkdir -p -m 0700 "$XDG_RUNTIME_DIR" "$HOME"

if [[ "${1:-}" == "--shot" ]]; then
  comp="$(cat /tmp/banc/compositor)"
  case "$comp" in
    sway) WAYLAND_DISPLAY="$(cat /tmp/banc/wayland)" grim "$2" ;;
    x11) DISPLAY=:99 import -window root "$2" ;;
    *) echo "capture d'écran impossible sous $comp (pas de screencopy) : preuves par CDP et journaux" >&2; exit 2 ;;
  esac
  exit
fi

comp="$1"; shift
echo "$comp" > /tmp/banc/compositor
case "$comp" in
  mutter)
    mutter --headless --wayland --no-x11 --virtual-monitor 1920x1080 --wayland-display=wayland-banc \
      > /tmp/banc/compositor.log 2>&1 &
    export WAYLAND_DISPLAY=wayland-banc XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=GNOME; unset DISPLAY ;;
  kwin)
    kwin_wayland --virtual --width 1920 --height 1080 --no-lockscreen --socket wayland-banc \
      > /tmp/banc/compositor.log 2>&1 &
    export WAYLAND_DISPLAY=wayland-banc XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=KDE KDE_SESSION_VERSION=6
    unset DISPLAY ;;
  sway)
    printf 'output HEADLESS-1 resolution 1920x1080\nxwayland disable\n' > /tmp/sway.cfg
    WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman sway -c /tmp/sway.cfg \
      > /tmp/banc/compositor.log 2>&1 &
    sleep 3
    export WAYLAND_DISPLAY="$(ls "$XDG_RUNTIME_DIR" | grep -E '^wayland-[0-9]+$' | head -1)"
    export XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=sway; unset DISPLAY ;;
  x11)
    Xvfb :99 -screen 0 1920x1080x24 +extension Composite > /tmp/banc/xvfb.log 2>&1 &
    sleep 1
    export DISPLAY=:99 XDG_SESSION_TYPE=x11; unset WAYLAND_DISPLAY
    openbox > /tmp/banc/compositor.log 2>&1 & ;;
  *) echo "compositeur inconnu : $comp" >&2; exit 2 ;;
esac
echo "${WAYLAND_DISPLAY:-}" > /tmp/banc/wayland
sleep 3
# Une vidéo locale pour les preuves du lecteur (mpv-libs de Fedora : VP8/VP9/AV1, pas de H.264).
[[ -f /tmp/banc/test.webm ]] || ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1280x720:rate=25 \
  -f lavfi -i sine=frequency=440 -t 120 -c:v libvpx -deadline realtime -cpu-used 8 -b:v 1M \
  -c:a libvorbis /tmp/banc/test.webm
export TENTACLE_ELECTRON_PROFILE=/cache/profiles/parite-linux
# Aucun GPU dans la VM : Mesa logiciel (llvmpipe, lavapipe), que mpv refuse sans gpu-sw.
export TENTACLE_MPV_GPU_SW=1
exec node /repo/apps/desktop-cef/scripts/dev.mjs run --skip-web --mute --background \
  --devtools-port=9427 "$@" > /tmp/banc/app.log 2>&1
