#!/usr/bin/env bash
# Dans le conteneur du banc croisé (lancé par bench/update/cross-test.sh) : /src = le dépôt en
# lecture seule, /build = les constructions (cache de l'hôte).
set -uo pipefail
warnings() { grep -E "warning:|error:" "$1" | sort -u | sed 's/^/  /'; }

echo "== Linux ($(uname -m), $(uname -r)) : règle et moteur"
cmake -G Ninja -S /src/src/update -B /build/linux -DCMAKE_BUILD_TYPE=Debug >/dev/null || exit 1
ninja -C /build/linux -j2 >/build/linux.log 2>&1 || { warnings /build/linux.log; exit 1; }
warnings /build/linux.log
/build/linux/tentacle_update_tests 2>/build/linux/tests.err || { grep -v '^\[maj\]' /build/linux/tests.err; exit 1; }
/build/linux/tentacle_update_system_check
APPIMAGE=/tmp/Tentacle.AppImage /build/linux/tentacle_update_system_check

echo "== Linux : parcours de bout en bout (moteur réel, fausses AppImages, flux signé local)"
bash /src/bench/update/cross/linux-e2e.sh /build/linux || exit 1

echo "== Windows (mingw-w64 $(x86_64-w64-mingw32-g++-posix -dumpversion)) : compilation et liens"
PKG_CONFIG_LIBDIR=/opt/mingw/lib/pkgconfig cmake -G Ninja -S /src/src/update -B /build/windows \
  -DCMAKE_TOOLCHAIN_FILE=/src/bench/update/cross/mingw.cmake -DCMAKE_BUILD_TYPE=Release >/dev/null || exit 1
ninja -C /build/windows -j2 >/build/windows.log 2>&1 || { warnings /build/windows.log; exit 1; }
warnings /build/windows.log
for f in tentacle_update_tests.exe tentacle_update_verify.exe tentacle_update_system_check.exe tentacle-update.exe; do
  [[ -f /build/windows/$f ]] && echo "  $f : $(stat -c %s /build/windows/$f) octets" || { echo "  ✗ $f absent"; exit 1; }
done
echo "  (non exécutés : pas de Windows ni de wine ici)"
