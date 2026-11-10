#!/usr/bin/env bash
# Le C de la compilation à blanc (SQLite, code C généré) : voir mingw-clang++.sh.
TENTACLE_MINGW_LANG=c exec "$(dirname "$0")/mingw-clang++.sh" "$@"
