#!/usr/bin/env bash
# clang++ d'Apple ciblant x86_64-w64-mingw32 (compilation À BLANC, bench/windows/syntax-check.sh) :
# en-têtes de mingw-w64 v14 et libc++ du SDK en configuration Windows, préparés par le script
# dans $TENTACLE_CEF_CACHE/deps/windows-check. TENTACLE_MINGW_LANG=c : le C (mingw-clang.sh).
work="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}/deps/windows-check"
sdk="$(xcrun --show-sdk-path)"
res="$(clang -print-resource-dir)"
# mingw-w64 14 : IReference<boolean> et IReference<BYTE> se confondent dans windows.foundation.h
# (windows.media.h : SMTC de l'axe medias) ; MSVC n'en a pas besoin.
common=(-target x86_64-w64-mingw32 -Wno-nonportable-include-path -Wno-unknown-pragmas
  -D____FIReference_1_boolean_INTERFACE_DEFINED__)
case "${TENTACLE_MINGW_LANG:-c++}" in
  c)
    exec clang "${common[@]}" -nostdinc -isystem "$res/include" -isystem "$work/mingw/inc" "$@" ;;
  *)
    exec clang++ "${common[@]}" -nostdinc -nostdinc++ -isystem "$work/libcxx" -isystem "$sdk/usr/include/c++/v1" \
      -isystem "$res/include" -isystem "$work/mingw/inc" "$@" ;;
esac
