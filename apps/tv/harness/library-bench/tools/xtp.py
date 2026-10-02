# Agrège un export « time-profile » d'xctrace : par fil, temps propre et
# inclusif des fonctions natives (1 échantillon = son poids en ms).
import sys, collections, re
import xml.etree.ElementTree as ET
path = sys.argv[1]; want = sys.argv[2] if len(sys.argv) > 2 else "Main Thread"
frames, backtraces, threads = {}, {}, {}
per_thread = collections.Counter()
selfc = collections.Counter(); incl = collections.Counter()
def frame_name(el):
    if el.get("ref"): return frames.get(el.get("ref"), "?")
    nm = el.get("name") or el.get("addr") or "?"
    frames[el.get("id")] = nm
    return nm
for ev, el in ET.iterparse(path, events=("end",)):
    if el.tag != "row": continue
    th = el.find("thread")
    if th is not None:
        if th.get("ref"): tname = threads.get(th.get("ref"), "?")
        else:
            tname = th.get("fmt", "?"); threads[th.get("id")] = tname
    w = el.find("weight")
    ms = 1.0
    if w is not None and w.text and w.text.isdigit(): ms = int(w.text) / 1e6
    bt = el.find("backtrace")
    stack = []
    if bt is not None:
        if bt.get("ref"): stack = backtraces.get(bt.get("ref"), [])
        else:
            stack = [frame_name(f) for f in bt.findall("frame")]
            backtraces[bt.get("id")] = stack
    short = re.sub(r" 0x[0-9a-f]+ \(.*", "", tname)
    per_thread[short] += ms
    if want in tname:
        if stack:
            selfc[stack[0]] += ms
            for nm in set(stack): incl[nm] += ms
    el.clear()
print("Par fil (ms) :")
for t, ms in per_thread.most_common(12): print(f"{ms:8.0f}  {t}")
print(f"\n{want} — temps propre :")
for nm, ms in selfc.most_common(30): print(f"{ms:8.0f}  {nm[:150]}")
print(f"\n{want} — inclusif :")
for nm, ms in incl.most_common(70): print(f"{ms:8.0f}  {nm[:150]}")
