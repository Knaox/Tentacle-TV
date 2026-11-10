#!/bin/bash
# Construit le client fake_input du banc depuis le protocole de KDE (paquet
# plasma-wayland-protocols) : build-fakeinput.sh <dossier de sortie>
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?dossier de sortie}
xml=${FAKE_INPUT_XML:-/usr/share/plasma-wayland-protocols/fake-input.xml}
[ -f "$xml" ] || { echo "protocole absent : $xml (paquet plasma-wayland-protocols, ou FAKE_INPUT_XML)" >&2; exit 1; }
mkdir -p "$out"
wayland-scanner client-header "$xml" "$out/fake-input-client.h"
wayland-scanner private-code "$xml" "$out/fake-input-protocol.c"
cc -O1 -I"$out" "$here/fakeinput.c" "$out/fake-input-protocol.c" -o "$out/fakeinput" $(pkg-config --cflags --libs wayland-client)
echo "$out/fakeinput"
