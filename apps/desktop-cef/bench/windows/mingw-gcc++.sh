#!/usr/bin/env bash
# GCC de mingw-w64 (conteneur du banc croisé) pour la compilation à blanc : la même définition que
# mingw-clang++.sh pour les en-têtes WinRT de mingw-w64 14 (montés sur ceux du conteneur).
exec /usr/bin/x86_64-w64-mingw32-g++-posix -D____FIReference_1_boolean_INTERFACE_DEFINED__ "$@"
