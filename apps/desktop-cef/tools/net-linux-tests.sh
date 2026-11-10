#!/bin/bash
# Construit la partie pure de l'axe reseau (src/net, shell/paths) sous Linux et lance ses tests — sans CEF.
# Depuis apps/desktop-cef : docker run --rm --cpus 2 -v "$PWD:/src:ro" tentacle-cef-maj-cross:bookworm /src/tools/net-linux-tests.sh
# (image de l'axe linux : g++ 12, nlohmann-json ; /src = apps/desktop-cef, en lecture seule).
set -u
cd /src
O=/tmp/o; mkdir -p $O
FLAGS="-std=gnu++20 -O1 -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers -Isrc -Isrc/bridge -pthread"
SRCS="src/shell/paths.cpp src/net/sha256.cpp src/net/web_url.cpp src/net/web_text.cpp src/net/fs_platform.cpp src/net/art_policy.cpp src/net/art_cache.cpp src/net/csp.cpp src/net/plugin_documents.cpp src/net/arg_check.cpp src/net/jellyfin_relay.cpp src/net/client_fetch_policy.cpp src/net/client_fetch_run.cpp src/net/client_fetch_commands.cpp src/net/local_socket.cpp src/net/direct_relay.cpp src/net/direct_relay_serve.cpp src/net/direct_source.cpp src/net/media_warm.cpp"
objs=""
for f in $SRCS; do
  o=$O/$(basename $f .cpp).o
  g++ $FLAGS -c $f -o $o 2>&1 | grep -E "warning|error" | head -5
  objs="$objs $o"
done
fail=0
for t in paths art_policy art_cache plugin_csp jellyfin client_fetch_policy client_fetch direct_relay media_warm; do
  if g++ $FLAGS src/net/tests/${t}_tests.cpp $objs -o $O/$t 2>$O/$t.log; then
    $O/$t 2>&1 | grep -v "^\[client-fetch\]" || fail=1
  else
    echo "== $t : ÉCHEC DE CONSTRUCTION"; grep -E "error" $O/$t.log | head; fail=1
  fi
done
echo "uname : $(uname -sm), $(g++ --version | head -1)"
exit $fail
