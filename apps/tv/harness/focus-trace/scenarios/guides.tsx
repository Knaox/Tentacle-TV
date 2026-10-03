import { createFocusStore } from "@bench/focusStore";
import { createEntryGuide } from "@bench/entryGuide";
import { useKeepFocusWithin } from "@bench/keepFocusWithin";
import { advance, fakeNode, mount, record, step, takeTrace, type Trace } from "../runtime";

/**
 * Le guide d'entrée d'un groupe (la destination qu'il pose, son `focusable`,
 * ses pièges) et la garde d'une surface plein écran (ses réclamations).
 */

type Store = ReturnType<typeof createFocusStore>;
type Guide = { destinations?: Array<{ __name?: string }>; focusable?: boolean; trapFocusLeft?: boolean; trapFocusRight?: boolean };

const guides = () => (globalThis as unknown as { __guides: Record<string, Guide> }).__guides;
function guideState(label: string) {
  const guide = guides().guide;
  record("guide", label, guide ? { to: (guide.destinations ?? []).map((node) => node.__name), focusable: guide.focusable, left: guide.trapFocusLeft, right: guide.trapFocusRight } : null);
}

function attach(store: Store, key: string) {
  step(() => store.binder(key)?.ref?.(fakeNode(key) as never));
}
const detach = (store: Store, key: string) => step(() => store.binder(key)?.ref?.(null));
const focus = (store: Store, key: string) => step(() => store.binder(key)?.onFocus?.());
const blur = (store: Store, key: string) => step(() => store.binder(key)?.onBlur?.());

function entryGuideRun(remember: boolean): void {
  const store = createFocusStore();
  let fallback: string | null = "episode:0";
  const Guide = createEntryGuide(store, { owns: (key) => key.startsWith("episode:"), fallback: () => fallback, remember, trapLeft: true });
  record("—", `remember=${remember}`);
  const view = mount(<Guide style={{ benchName: "guide" } as never}>{null}</Guide>);
  guideState("monté, rien d'attaché");
  attach(store, "episode:0");
  attach(store, "episode:3");
  view.render(<Guide style={{ benchName: "guide" } as never}>{null}</Guide>);
  guideState("après rendu");
  focus(store, "episode:3");
  guideState("épisode 3 visité");
  focus(store, "season:1");
  guideState("focus hors du groupe");
  fallback = "episode:0";
  detach(store, "episode:3");
  view.render(<Guide style={{ benchName: "guide" } as never}>{null}</Guide>);
  guideState("le visité démonté");
  fallback = null;
  view.render(<Guide style={{ benchName: "guide" } as never}>{null}</Guide>);
  guideState("plus d'entrée par défaut");
  view.unmount();
}

export function entryGuides(): Trace {
  entryGuideRun(true);
  entryGuideRun(false);
  return takeTrace();
}

function Surface({ store }: { store: Store }) {
  useKeepFocusWithin(store, ["offline:retry", "offline:unpair"], "offline:retry");
  return null;
}

export function keepWithin(): Trace {
  const store = createFocusStore();
  for (const key of ["offline:retry", "offline:unpair", "status:primary"]) attach(store, key);
  const view = mount(<Surface store={store} />);
  advance(300);
  focus(store, "offline:retry");
  record("—", "le voisin reçoit le focus dans les 50 ms");
  blur(store, "offline:retry");
  advance(20);
  focus(store, "offline:unpair");
  advance(300);
  record("—", "le voisin l'annonce trop tard (70 ms)");
  blur(store, "offline:unpair");
  advance(70);
  focus(store, "offline:retry");
  advance(300);
  record("—", "un écran d'en dessous le réclame");
  blur(store, "offline:unpair");
  focus(store, "status:primary");
  advance(300);
  record("—", "le focus part nulle part (Modal)");
  blur(store, "offline:retry");
  blur(store, "offline:unpair");
  advance(300);
  view.unmount();
  advance(300);
  return takeTrace();
}
