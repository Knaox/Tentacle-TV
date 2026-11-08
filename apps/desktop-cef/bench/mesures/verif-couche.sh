#!/usr/bin/env bash
# Vérifie la couche web du proto (axe ram) : cadence pendant une animation avec 2 drawables, puis
# que l'image affichée RESTE après la veille profonde (trim : drawableSize 1×1). Capture de la
# SEULE fenêtre de l'app (screencapture -l), avant et après le trim, comparaison des pixels.
# Le verrou d'écran du lot doit être tenu par l'appelant ; la session doit être déverrouillée.
#
#   bench/mesures/verif-couche.sh [Tentacle.app]
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="$HOME/.cache/tentacle-cef"
APP="${1:-$CACHE/build/ram/Tentacle.app}"
OUT="$CACHE/build/ram-diag/verif-couche"
PORT=9311
mkdir -p "$OUT"
"$APP/Contents/MacOS/Tentacle" --mute --url=http://127.0.0.1:3471 --devtools-port=$PORT \
  --profile="$CACHE/profiles/ram" > "$OUT/app.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null' EXIT
for i in $(seq 60); do curl -s "http://127.0.0.1:$PORT/json/list" | grep -q '"page"' && break; sleep 0.5; done
sleep 4
echo "accueil : $(node "$HERE/scenario.mjs" $PORT accueil | tail -1)"
ev() { node "$(dirname "$HERE")/../tools/cdp-eval.mjs" $PORT "$1"; }

# 1. Cadence avec une animation (2 drawables au plus).
ev "(async () => { const d = document.createElement('div'); d.id = '__v'; d.style.cssText = 'position:fixed;left:8px;top:8px;width:24px;height:24px;background:#f0f;z-index:99999;animation:__vk 1s linear infinite';
  const st = document.createElement('style'); st.id = '__vs'; st.textContent = '@keyframes __vk{to{transform:translateX(240px)}}'; document.head.append(st); document.body.append(d);
  const out = []; for (let i = 0; i < ${SAMPLES:-3}; i++) { await new Promise((r) => setTimeout(r, 2000)); const s = await __shell.invoke('shell.stats');
    out.push(s.presentedFps + ' img/s, moy ' + s.presentIntervalMeanMs.toFixed(2) + ' ms, max ' + s.presentIntervalMaxMs.toFixed(2) + ' ms'); }
  return 'animation (${SAMPLES:-3} relevés de 120 intervalles) : ' + out.join(' | '); })()"
ev "(() => { document.getElementById('__v').remove(); document.getElementById('__vs').remove(); return true; })()" > /dev/null

[[ "${TRIM:-1}" == 0 ]] && exit 0
# 2. Image affichée avant / après le trim (veille profonde au bout de 3 s sans image).
WID=$("$CACHE/build/mesures/fenetres" 20 | awk -v p="$PID" '$0 ~ "pid "p" " {for (i = 1; i <= NF; i++) if ($i == "fenêtre") print $(i + 1)}' | head -1)
echo "fenêtre de l'app : ${WID:-introuvable} ; dessus : $("$CACHE/build/mesures/fenetres" 1 | tr -s ' ')"
# La bannière d'accueil tourne 20 s après le dernier geste (useIdle du front) : on attend
# qu'elle s'arrête, puis UNE image (contour quasi transparent) réveille la couche juste avant
# la capture « avant » ; 6 s plus tard, la veille profonde a fait le trim.
sleep 35
ev "(() => { document.body.style.outline = '1px solid rgba(0,0,0,0.004)'; return true; })()" > /dev/null
sleep 0.6
screencapture -x -o -l "$WID" "$OUT/avant.png"
echo "avant : $(ev "__shell.invoke('shell.debug.layers').then((t) => t.split('\n').find((l) => /CAMetalLayer z=10/.test(l)).trim())")"
sleep 6
echo "après : $(ev "__shell.invoke('shell.debug.layers').then((t) => t.split('\n').find((l) => /CAMetalLayer z=10/.test(l)).trim())")"
screencapture -x -o -l "$WID" "$OUT/apres.png"
for f in avant apres; do sips -s format bmp "$OUT/$f.png" --out "$OUT/$f.bmp" > /dev/null; done
python3 - "$OUT/avant.bmp" "$OUT/apres.bmp" <<'PY'
import struct, sys
def load(p):
    b = open(p, "rb").read()
    off, w, h, bpp = struct.unpack_from("<I", b, 10)[0], *struct.unpack_from("<ii", b, 18), struct.unpack_from("<H", b, 28)[0]
    step = bpp // 8; row = (w * step + 3) & ~3
    px = [b[off + y * row + x * step: off + y * row + x * step + 3] for y in range(0, abs(h), 4) for x in range(0, w, 4)]
    return w, abs(h), px
wa, ha, a = load(sys.argv[1]); wb, hb, c = load(sys.argv[2])
lum = lambda px: sum(sum(p) / 3 for p in px) / len(px)
diff = sum(1 for p, q in zip(a, c) if max(abs(p[i] - q[i]) for i in range(3)) > 8) / max(len(a), 1)
print(f"capture {wa}×{ha} → {wb}×{hb} ; luminance moyenne avant {lum(a):.1f}, après {lum(c):.1f} ; pixels différents {diff * 100:.2f} %")
PY
