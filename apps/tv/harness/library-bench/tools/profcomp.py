# Temps inclusif par fonction NOMMÉE d'un .cpuprofile Hermes (composants, crochets),
# et, pour une fonction cible, la répartition par appelant nommé le plus proche.
import json, sys, collections
prof = json.load(open(sys.argv[1]))
targets = sys.argv[2:]
nodes = {n["id"]: n for n in prof["nodes"]}
parent = {}
for n in prof["nodes"]:
    for c in n.get("children", []): parent[c] = n["id"]
def fname(nid): return nodes[nid]["callFrame"]["functionName"] or "(anon)"
deltas = prof.get("timeDeltas") or []
incl = collections.Counter()
by_caller = collections.defaultdict(collections.Counter)
FRAMEWORK = set("""__guard callFunctionReturnFlushedQueue __callFunction flushedQueue performSyncWorkOnRoot flushSyncWorkAcrossRoots_impl workLoopSync renderRootSync performWorkOnRoot performUnitOfWork _callTimer batchedUpdates$1 batchedUpdatesImpl _receiveRootNodeIDEvent receiveEvent tryCallOne _callReactNativeMicrotasksPass callReactNativeMicrotasks __callReactNativeMicrotasks beginWork completeWork renderWithHooks updateFunctionComponent updateMemoComponent updateSimpleMemoComponent mountIndeterminateComponent reconcileChildren reconcileChildFibers reconcileChildrenArray commitRoot commitRootImpl (anon) [root] (idle) metroRequire""".split())
for i, sid in enumerate(prof["samples"]):
    dt = deltas[i] / 1000 if i < len(deltas) else 0
    seen = set(); chain = []
    cur = sid
    while cur is not None:
        nm = fname(cur)
        chain.append(nm)
        if nm not in seen:
            incl[nm] += dt; seen.add(nm)
        cur = parent.get(cur)
    for t in targets:
        if t in chain:
            idx = chain.index(t)
            caller = next((c for c in chain[idx + 1:] if c not in FRAMEWORK and not c.startswith("[")), "?")
            by_caller[t][caller] += dt
print("Temps inclusif (ms), hors cadre :")
for nm, ms in incl.most_common(400):
    if nm in FRAMEWORK or nm.startswith("[") or ms < 15: continue
    print(f"{ms:8.0f}  {nm}")
for t in targets:
    print(f"\n{t} — par appelant :")
    for c, ms in by_caller[t].most_common(15): print(f"{ms:8.0f}  {c}")
