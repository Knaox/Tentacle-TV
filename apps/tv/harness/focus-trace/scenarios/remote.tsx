import { useState } from "react";
import { createFocusStore } from "@bench/focusStore";
import { useBeyondEdge } from "@bench/beyondEdge";
import { useHeroRotation } from "@bench/heroRotation";
import { menuPressed } from "@bench/menu";
import { advance, appState, clock, emit, fakeNode, mount, record, step, takeTrace, type Trace } from "../runtime";

/**
 * Ce qui écoute la télécommande : « au-delà du bord » (un appel par geste
 * au-delà du bouton du bord) et la rotation du héros (quand le titre change).
 * Menu ne vient pas de TVEventHandler : dans l'arbre courant il passe par
 * l'entrée unique (`receiveMenu`), dans la référence il n'arrivait nulle part.
 */

declare const __BENCH_RIGHT__: string;
type Store = ReturnType<typeof createFocusStore>;

function attach(store: Store, key: string) {
  step(() => store.binder(key)?.ref?.(fakeNode(key) as never));
}
const focus = (store: Store, key: string) => step(() => store.binder(key)?.onFocus?.());
const blur = (store: Store, key: string) => step(() => store.binder(key)?.onBlur?.());

function Edge({ store, edgeKey, enabled }: { store: Store; edgeKey: string | null; enabled: boolean }) {
  useBeyondEdge(store, { edgeKey, direction: __BENCH_RIGHT__ as never, enabled, onBeyond: () => record("au-delà") });
  return null;
}

export function beyondEdge(): Trace {
  const store = createFocusStore();
  for (const key of ["hero:primary", "hero:secondary", "hero:list"]) attach(store, key);
  const view = mount(<Edge store={store} edgeKey="hero:list" enabled />);
  focus(store, "hero:secondary");
  advance(500);
  record("—", "le geste qui amène au bord");
  blur(store, "hero:secondary");
  focus(store, "hero:list");
  advance(60);
  emit("right", 1);
  advance(300);
  emit("right", 1);
  record("—", "posé depuis plus de 400 ms");
  advance(200);
  emit("right", 1);
  emit("swipeRight");
  emit("right", 0);
  emit("right");
  emit("longRight", 0);
  emit("longRight", 1);
  emit("left", 1);
  emit("swipeUp");
  record("—", "le focus ailleurs");
  blur(store, "hero:list");
  focus(store, "hero:secondary");
  advance(500);
  emit("right", 1);
  record("—", "désactivé, puis sans bord");
  blur(store, "hero:secondary");
  focus(store, "hero:list");
  advance(500);
  view.render(<Edge store={store} edgeKey="hero:list" enabled={false} />);
  emit("right", 1);
  view.render(<Edge store={store} edgeKey={null} enabled />);
  emit("right", 1);
  view.render(<Edge store={store} edgeKey="hero:list" enabled />);
  emit("right", 1);
  view.unmount();
  return takeTrace();
}

function Hero({ store, count, shown }: { store: Store; count: number; shown: boolean }) {
  const [index, setIndex] = useState(0);
  useHeroRotation({ focus: store, count, index, shown, onAdvance: () => setIndex((i) => (i + 1) % count) });
  record("index", index);
  return null;
}

export function heroRotation(): Trace {
  const store = createFocusStore();
  for (const key of ["hero:primary", "hero:secondary"]) attach(store, key);
  const view = mount(<Hero store={store} count={3} shown />);
  focus(store, "hero:primary");
  advance(8_500);
  record("—", "les gestes relancent l'attente", clock());
  emit("right", 1);
  advance(5_000);
  emit("swipeDown");
  advance(5_000);
  emit("select", 1);
  advance(5_000);
  emit("playPause", 1);
  advance(5_000);
  menuPressed();
  advance(3_500);
  record("—", "un pas du focus la relance");
  advance(4_000);
  blur(store, "hero:primary");
  focus(store, "hero:secondary");
  advance(6_000);
  record("—", "un maintien la suspend, sa suite ou sa fin la libère");
  emit("longSelect", 0);
  advance(20_000);
  emit("longSelect");
  advance(9_000);
  emit("longSelect", 0);
  advance(3_000);
  emit("longSelect", 1);
  advance(9_000);
  record("—", "hors champ, application inactive, un seul titre");
  view.render(<Hero store={store} count={3} shown={false} />);
  advance(20_000);
  view.render(<Hero store={store} count={3} shown />);
  advance(9_000);
  appState("background");
  advance(20_000);
  appState("active");
  advance(9_000);
  view.render(<Hero store={store} count={1} shown />);
  advance(20_000);
  view.unmount();
  return takeTrace();
}
