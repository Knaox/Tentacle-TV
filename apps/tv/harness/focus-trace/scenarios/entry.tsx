import { createFocusStore } from "@bench/focusStore";
import { useEntryFocus } from "@bench/entryFocus";
import { advance, fakeNode, mount, record, screenFocused, step, takeTrace, type Trace } from "../runtime";

/**
 * L'entrée d'un écran et le retour sur lui : la préférence posée pendant
 * l'arrivée (relevée sur la liaison des clés), les réclamations, la clôture
 * (contenu, ou navigation après 600 ms), `contentKey()` et le retour.
 */

type Store = ReturnType<typeof createFocusStore>;

const KEYS = ["status:primary", "hero:primary", "resume:0", "nav:Home"];
function preferences(store: Store, label: string) {
  const preferred = KEYS.filter((key) => (store.binder(key)?.native as { hasTVPreferredFocus?: boolean } | undefined)?.hasTVPreferredFocus);
  record("préférence", label, preferred);
}
function attach(store: Store, key: string) {
  step(() => store.binder(key)?.ref?.(fakeNode(key) as never));
}
const focus = (store: Store, key: string) => step(() => store.binder(key)?.onFocus?.());
const blur = (store: Store, key: string) => step(() => store.binder(key)?.onBlur?.());

let contentKey: (() => string | null) | null = null;
function Screen({ store, entry }: { store: Store; entry: string | null }) {
  contentKey = useEntryFocus(store, entry).contentKey;
  return null;
}

function arrival(railAfterMs: number, label: string) {
  const store = createFocusStore();
  record("—", label);
  screenFocused(true);
  const view = mount(<Screen store={store} entry={null} />);
  preferences(store, "chargement");
  view.render(<Screen store={store} entry="status:primary" />);
  preferences(store, "erreur");
  attach(store, "status:primary");
  advance(300);
  view.render(<Screen store={store} entry="hero:primary" />);
  preferences(store, "héros");
  attach(store, "hero:primary");
  attach(store, "nav:Home");
  attach(store, "resume:0");
  advance(railAfterMs);
  focus(store, "nav:Home");
  preferences(store, `navigation à +${railAfterMs} ms`);
  advance(200);
  blur(store, "nav:Home");
  focus(store, "resume:0");
  preferences(store, "contenu");
  record("contentKey", contentKey?.());
  view.render(<Screen store={store} entry="status:primary" />);
  preferences(store, "entrée changée après l'arrivée");
  advance(300);
  record("—", "retour sur l'écran");
  screenFocused(false);
  advance(100);
  screenFocused(true);
  advance(300);
  step(() => store.binder("resume:0")?.ref?.(null));
  record("contentKey (démontée)", contentKey?.());
  screenFocused(false);
  screenFocused(true);
  advance(300);
  view.unmount();
  advance(300);
}

export function entryFocus(): Trace {
  arrival(100, "navigation tôt (400 ms après l'arrivée)");
  arrival(250, "navigation juste avant 600 ms (550 ms)");
  arrival(350, "navigation juste après 600 ms (650 ms)");
  arrival(900, "navigation tard (1 200 ms)");
  return takeTrace();
}
