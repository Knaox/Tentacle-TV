# Pour une fonction X du fil voulu : ses appelés directs (temps inclusif), et ses appelants.
import sys, collections
import xml.etree.ElementTree as ET
path, want, target = sys.argv[1], sys.argv[2], sys.argv[3]
frames, backtraces, threads = {}, {}, {}
callees = collections.Counter(); callers = collections.Counter(); total = 0.0
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
        else: tname = th.get("fmt", "?"); threads[th.get("id")] = tname
    w = el.find("weight"); ms = int(w.text) / 1e6 if w is not None and w.text and w.text.isdigit() else 1.0
    bt = el.find("backtrace"); stack = []
    if bt is not None:
        if bt.get("ref"): stack = backtraces.get(bt.get("ref"), [])
        else: stack = [frame_name(f) for f in bt.findall("frame")]; backtraces[bt.get("id")] = stack
    if want in tname:
        idx = next((i for i, f in enumerate(stack) if target in f), None)
        if idx is not None:
            total += ms
            callees[stack[idx - 1] if idx > 0 else "(propre)"] += ms
            callers[stack[idx + 1] if idx + 1 < len(stack) else "(racine)"] += ms
    el.clear()
print(f"{target} : {total:.0f} ms")
print("  appelés :")
for nm, ms in callees.most_common(12): print(f"    {ms:6.0f}  {nm[:140]}")
print("  appelants :")
for nm, ms in callers.most_common(8): print(f"    {ms:6.0f}  {nm[:140]}")
