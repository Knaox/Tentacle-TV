#!/usr/bin/env python3
# Retire de resources.pak (format pak v5 de Chromium) des ressources que Tentacle ne demande
# jamais, choisies PAR NOM d'après include/cef_pack_resources.h de la même distribution CEF :
#   - toute la section « devtools_resources.h » : le front-end DevTools (fenêtre d'inspection).
#     Le protocole CDP (--devtools-port, bancs) n'en dépend pas : il est dans le binaire ;
#   - IDR_INTRO_SOUND_* : les sons de la page d'accueil de Chrome (FLAC, ~4,6 Mo) ;
#   - la section « tracing_resources.h » : la page interne chrome://tracing (0,7 Mo).
# La HRTF de Web Audio (IDR_AUDIO_SPATIALIZATION_COMPOSITE) reste : un PannerNode « HRTF »
# sans elle ferait tomber le processus de rendu.
# Usage : trim-pak.py <resources.pak> <cef_pack_resources.h>   (réécrit le .pak en place)
import re
import struct
import sys

pak_path, header_path = sys.argv[1], sys.argv[2]

drop, section = set(), ""
for line in open(header_path, encoding="utf-8"):
    m = re.match(r"// From (\S+):", line)
    if m:
        section = m.group(1)
        continue
    m = re.match(r"#define (\w+) (\d+)", line)
    if m and (section in ("devtools_resources.h", "tracing_resources.h")
              or m.group(1).startswith("IDR_INTRO_SOUND_")):
        drop.add(int(m.group(2)))
if len(drop) < 100:
    sys.exit(f"trim-pak : {len(drop)} ressources seulement à retirer — en-tête inattendu")

data = open(pak_path, "rb").read()
version, = struct.unpack_from("<I", data, 0)
if version != 5:
    sys.exit(f"trim-pak : pak version {version}, seule la 5 est connue")
head = data[:8]  # version + encodage (+ bourrage), recopiés tels quels
count, alias_count = struct.unpack_from("<HH", data, 8)
entries = [struct.unpack_from("<HI", data, 12 + i * 6) for i in range(count + 1)]
aliases_at = 12 + (count + 1) * 6
aliases = [struct.unpack_from("<HH", data, aliases_at + i * 4) for i in range(alias_count)]

kept, new_index = [], {}
for i in range(count):
    rid, off = entries[i]
    if rid not in drop:
        new_index[i] = len(kept)
        kept.append((rid, data[off:entries[i + 1][1]]))
kept_aliases = [(rid, new_index[idx]) for rid, idx in aliases if idx in new_index and rid not in drop]

table = 12 + (len(kept) + 1) * 6 + len(kept_aliases) * 4
out = bytearray(head + struct.pack("<HH", len(kept), len(kept_aliases)))
off = table
for rid, blob in kept:
    out += struct.pack("<HI", rid, off)
    off += len(blob)
out += struct.pack("<HI", 0, off)
for rid, idx in kept_aliases:
    out += struct.pack("<HH", rid, idx)
for _, blob in kept:
    out += blob
open(pak_path, "wb").write(out)
print(f"trim-pak : {count - len(kept)} ressources et {alias_count - len(kept_aliases)} alias retirés, "
      f"{len(data) / 1048576:.1f} → {len(out) / 1048576:.1f} Mo")
