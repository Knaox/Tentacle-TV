import { useChoiceEntry } from "@bench/src/redesignWiring/settings/settingsFocus";
import { createFocusStore, type FocusStore } from "@bench/focusStore";
import { note } from "../stubs/record";
import { mount, take } from "./root";

/**
 * Le verrou d'entrée d'une liste en Modal (`useChoiceEntry`) : ce qu'il
 * verrouille et libère, sur les liaisons et sur les nœuds montés, et quand.
 */

const KEYS = ["a", "b", "c", "d"];

function Probe({ store, keys, entry }: { store: FocusStore; keys: string[]; entry: string | null }) {
  const releases = useChoiceEntry(store, keys, entry);
  note({ releases });
  return null;
}

function locks(store: FocusStore): string[] {
  return KEYS.filter((key) => store.binder(key)?.native?.isTVSelectable === false);
}

export function runChoiceEntry(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const bench = mount();
  const store = createFocusStore();
  for (const key of KEYS) {
    const ref = store.binder(key)?.ref as ((node: unknown) => void) | undefined;
    ref?.({ setNativeProps: (props: object) => note({ native: key, props }) });
  }
  const step = (label: string, fn: () => void) => {
    fn();
    out[label] = [...take(), { locked: locks(store) }];
  };
  const focus = (key: string) => bench.run(() => store.binder(key)?.onFocus?.());
  const render = (entry: string | null, keys = KEYS) => bench.render(<Probe store={store} keys={keys} entry={entry} />);

  step("sans entrée", () => render(null));
  step("entrée c", () => render("c"));
  step("focus sur a", () => focus("a"));
  step("focus sur c : libéré", () => focus("c"));
  step("même entrée, liste qui change", () => render("c", ["a", "b", "c", "d", "e"]));
  step("nouvelle entrée a", () => render("a"));
  step("799 ms", () => bench.advance(799));
  step("800 ms : le filet libère", () => bench.advance(1));
  step("entrée b", () => render("b"));
  step("entrée retombée", () => render(null));
  step("entrée d puis démontage", () => {
    render("d");
    bench.unmount();
  });
  step("le filet après le démontage", () => bench.advance(1000));
  return out;
}
