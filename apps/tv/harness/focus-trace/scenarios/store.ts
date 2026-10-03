import { createFocusStore } from "@bench/focusStore";
import { claimAfterRestore } from "@bench/claimAfterRestore";
import { advance, fakeNode, record, step, takeTrace, type Trace } from "../runtime";

/**
 * Le magasin de focus et la reprise après restauration : le suivi des clés,
 * les réclamations (montée, en attente du montage, annulée) et la reprise
 * de `claimAfterRestore` dans ses 900 ms.
 */

type Store = ReturnType<typeof createFocusStore>;

function attach(store: Store, key: string) {
  const node = fakeNode(key);
  store.binder(key)?.ref?.(node as never);
  return node;
}
const focus = (store: Store, key: string) => step(() => store.binder(key)?.onFocus?.());
const blur = (store: Store, key: string) => step(() => store.binder(key)?.onBlur?.());
const state = (store: Store) => record("state", store.focusedKey(), store.lastFocusedKey());

export function storeTracking(): Trace {
  const store = createFocusStore();
  store.subscribe((key, focused) => record("listener", key, focused));
  attach(store, "a");
  attach(store, "b");
  state(store);
  focus(store, "a");
  state(store);
  blur(store, "a");
  focus(store, "b");
  state(store);
  blur(store, "a"); // un flou en retard
  state(store);
  blur(store, "b");
  state(store);
  return takeTrace();
}

export function storeClaims(): Trace {
  const store = createFocusStore();
  attach(store, "mounted");
  store.claim("mounted");
  advance(300);
  record("—", "réclamation en attente du montage");
  store.claim("later");
  advance(500);
  attach(store, "later");
  advance(300);
  record("—", "annulée avant le montage");
  const cancel = store.claim("never");
  cancel();
  attach(store, "never");
  advance(300);
  record("—", "annulée en route");
  const cancelRunning = store.claim("mounted");
  advance(60);
  cancelRunning();
  advance(300);
  record("focusNow", store.focusNow("mounted"), store.focusNow("absent"));
  record("handle", store.handle("mounted") !== null, store.handle("absent"));
  return takeTrace();
}

export function restoreClaims(): Trace {
  const run = (label: string, events: Array<[number, string, boolean]>) => {
    const store = createFocusStore();
    for (const key of ["target", "other", "third"]) attach(store, key);
    record("—", label);
    claimAfterRestore(store, "target");
    for (const [wait, key, focused] of events) {
      advance(wait);
      (focused ? focus : blur)(store, key);
    }
    advance(1_500);
  };
  run("restauration ailleurs dans le délai", [[300, "other", true], [100, "third", true]]);
  run("ailleurs juste avant la fin du délai", [[850, "other", true]]);
  run("ailleurs juste après le délai", [[950, "other", true]]);
  run("la cible d'abord, puis ailleurs", [[200, "target", true], [100, "target", false], [100, "other", true]]);
  run("une perte seulement", [[200, "other", false]]);
  return takeTrace();
}
