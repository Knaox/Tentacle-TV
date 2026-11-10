#!/bin/bash
# Contrôle de l'axe reseau pour Windows (mingw-w64, x86_64) — sans MSVC, sans lien CEF.
#  1) la partie pure (src/net, shell/paths) COMPILÉE et LIÉE en .exe de tests (non lancés : pas de Windows) ;
#  2) la colle CEF en -fsyntax-only, en-têtes CEF de macOS + les deux en-têtes propres à Windows
#     (cef_types_win.h, cef_win.h au commit cf671c0 de CEF 156.0.15) montés en /cefwin.
# Depuis apps/desktop-cef :
#   docker run --rm --cpus 2 -v "$PWD:/src:ro" -v "<CEF>:/cef:ro" -v "<hdr-cef-win>:/cefwin:ro" \
#     tentacle-cef-maj-cross:bookworm /src/tools/net-windows-syntax.sh
set -u
cd /src
CXX=x86_64-w64-mingw32-g++-posix
O=/tmp/w; mkdir -p $O /tmp/nl
cp -r /usr/include/nlohmann /tmp/nl/  # nlohmann seul : jamais les en-têtes de la glibc avec mingw
FLAGS="-std=gnu++20 -O1 -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers -Isrc -Isrc/bridge -I/tmp/nl -D_WIN32_WINNT=0x0A00"
SRCS="src/shell/paths.cpp src/net/sha256.cpp src/net/web_url.cpp src/net/web_text.cpp src/net/fs_platform.cpp src/net/art_policy.cpp src/net/art_cache.cpp src/net/csp.cpp src/net/plugin_documents.cpp src/net/arg_check.cpp src/net/jellyfin_relay.cpp src/net/client_fetch_policy.cpp src/net/client_fetch_run.cpp src/net/client_fetch_commands.cpp src/net/local_socket.cpp src/net/direct_relay.cpp src/net/direct_relay_serve.cpp src/net/direct_source.cpp src/net/media_warm.cpp"
fail=0; objs=""
for f in $SRCS; do
  o=$O/$(basename $f .cpp).o
  if out=$($CXX $FLAGS -c $f -o $o 2>&1); then [ -n "$out" ] && { echo "== $f"; echo "$out" | grep -E "warning|error" | head -5; }; else echo "== $f ÉCHEC"; echo "$out" | grep error | head -8; fail=1; fi
  objs="$objs $o"
done
for t in paths art_policy art_cache plugin_csp jellyfin client_fetch_policy client_fetch direct_relay media_warm; do
  if $CXX $FLAGS src/net/tests/${t}_tests.cpp $objs -o $O/$t.exe -lws2_32 -static 2>$O/$t.log; then echo "lié  $t.exe"; else echo "== $t ÉCHEC DU LIEN"; grep -E "error|undefined" $O/$t.log | head -5; fail=1; fi
done
# La colle CEF : syntaxe seulement (les en-têtes de Windows viennent de mingw).
INC="-Isrc -Isrc/bridge -I/tmp/nl -I/cefwin -I/cef"
for f in src/net/cef_fetch.cpp src/net/cef_stream.cpp src/net/cef_hop.cpp src/net/direct_shell.cpp src/net/net_shell.cpp src/net/farewell_stub.cpp src/schemes/art_scheme.cpp src/schemes/plugin_scheme.cpp src/schemes/buffered_handler.cpp src/shell/app_scheme.cpp; do
  if out=$($CXX -std=gnu++20 -fsyntax-only -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers -D_WIN32_WINNT=0x0A00 $INC $f 2>&1); then echo "ok   $f"; else echo "== $f ÉCHEC"; echo "$out" | grep -E "error" | head -8; fail=1; fi
done
exit $fail
