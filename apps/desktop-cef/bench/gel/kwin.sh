#!/bin/bash
# KWin VIRTUEL (aucun écran réel), bus D-Bus et dossiers XDG à lui : rien ne paraît sur la session de
# l'utilisateur. Le périphérique factice y est permis (fakeinput.c). Usage : kwin.sh start|stop
set -u
ROOT=${BANC_DIR:-$HOME/.cache/tentacle-test/cef-banc}
RUN=$ROOT/run
SOCK=${BANC_SOCKET:-wl-tentacle-banc}
case "${1:-start}" in
start)
  mkdir -p "$RUN"/{config,cache,data,state}
  rm -f "$RUN/dbus-addr"
  printf '[Wayland]\nInputMethod[$e]=\nVirtualKeyboardEnabled=false\n[Compositing]\nAnimationSpeed=0\n' > "$RUN/config/kwinrc"
  (
    unset DISPLAY WAYLAND_SOCKET
    export WAYLAND_DISPLAY=$SOCK KWIN_WAYLAND_NO_PERMISSION_CHECKS=1 QT_FORCE_STDERR_LOGGING=1
    export XDG_CONFIG_HOME=$RUN/config XDG_CACHE_HOME=$RUN/cache XDG_DATA_HOME=$RUN/data XDG_STATE_HOME=$RUN/state
    setsid dbus-run-session -- bash -c "echo \$DBUS_SESSION_BUS_ADDRESS > '$RUN/dbus-addr'; unset WAYLAND_DISPLAY; exec kwin_wayland --virtual --socket $SOCK --width ${W:-1920} --height ${H:-1080} --scale ${SCALE:-1} --no-lockscreen --no-global-shortcuts --no-kactivities" > "$RUN/kwin.log" 2>&1 < /dev/null &
    echo $! > "$RUN/kwin.pid"
  )
  for i in $(seq 1 50); do [ -S "$XDG_RUNTIME_DIR/$SOCK" ] && [ -s "$RUN/dbus-addr" ] && break; sleep 0.1; done
  ls -la "$XDG_RUNTIME_DIR/$SOCK" && echo "dbus: $(cat $RUN/dbus-addr)"
  ;;
stop)
  pid=$(cat "$RUN/kwin.pid" 2>/dev/null) && kill -- -"$pid" 2>/dev/null; kill "$pid" 2>/dev/null
  sleep 0.5; rm -f "$XDG_RUNTIME_DIR/$SOCK" "$XDG_RUNTIME_DIR/$SOCK.lock"
  echo stopped
  ;;
esac
