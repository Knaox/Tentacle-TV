import { useLayoutEffect, type ComponentType, type ReactNode } from "react";
import type { FocusBinder, FocusGroupContainerProps } from "@bench/src/redesign/focus/focusBinding";
import { useFocusStore, type FocusStore } from "@bench/src/redesignWiring/focus/focusStore";
import { useSheetFocus } from "@bench/sheetFocus";
import { hosts } from "../stubs/record";
import { mount, take } from "./root";

/**
 * Le focus du grand panneau (`useSheetFocus`) : la garde sur chaque cible,
 * les verrous d'entrée, et ce que visent les trois guides (`TVFocusGuideView`
 * des groupes), pas à pas — entrée, premier focus, picto visité, note posée.
 */

type Rating = { current: number | null; pending?: boolean } | null;
type Picto = { kind: string; label: string };

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `sheet:scale:${n}`).concat("sheet:scale:remove");
const GROUPS = ["sheet:header", "sheet:scale", "sheet:actions"] as const;
const nodes = new Map<string, object>();
const keyOf = new Map<object, string>();
function nodeOf(key: string): object {
  let node = nodes.get(key);
  if (!node) {
    node = { setNativeProps() {}, key };
    nodes.set(key, node);
    keyOf.set(node, key);
  }
  return node;
}

let latest: { store: FocusStore; bind: FocusBinder } | null = null;

function Target({ bind, id }: { bind: FocusBinder; id: string }) {
  const binding = bind(id);
  const ref = binding?.ref as ((node: unknown) => void) | undefined;
  useLayoutEffect(() => {
    ref?.(nodeOf(id));
    return () => ref?.(null);
  }, [ref, id]);
  hosts.set(`target:${id}`, { guard: binding?.phantomPressGuard === true, selectable: (binding?.native as { isTVSelectable?: boolean } | undefined)?.isTVSelectable ?? null });
  return null;
}

function Group({ store, group, children }: { store: FocusStore; group: string; children: ReactNode }) {
  const Container = store.binder(group)?.container as ComponentType<FocusGroupContainerProps> | undefined;
  return Container ? <Container style={{ guide: group } as never}>{children}</Container> : <>{children}</>;
}

function Probe({ rating, actions, entry }: { rating: Rating; actions: Picto[]; entry: string | null }) {
  const store = useFocusStore();
  const bind = useSheetFocus(store, { rating, actions: actions as never, entry });
  latest = { store, bind };
  const actionKeys = actions.map((a) => `sheet:action:${a.kind}`);
  return (
    <>
      <Group store={store} group="sheet:header"><Target bind={bind} id="sheet:close" /></Group>
      <Group store={store} group="sheet:scale">{SCALE.map((k) => <Target key={k} bind={bind} id={k} />)}</Group>
      <Group store={store} group="sheet:actions">{actionKeys.map((k) => <Target key={k} bind={bind} id={k} />)}</Group>
    </>
  );
}

function snapshot(actions: Picto[]): unknown {
  const keys = ["sheet:close", ...SCALE, ...actions.map((a) => `sheet:action:${a.kind}`)];
  const targets = Object.fromEntries(keys.map((k) => [k, hosts.get(`target:${k}`)]));
  const guides = Object.fromEntries(
    GROUPS.map((g) => {
      const props = hosts.get(`guide:${g}`) as { destinations?: object[]; focusable?: boolean } | undefined;
      return [g, props ? { to: (props.destinations ?? []).map((n) => keyOf.get(n) ?? "?"), focusable: props.focusable ?? null } : null];
    }),
  );
  return { targets, guides };
}

const PICTOS: Picto[] = ["play", "watchlist", "favorite", "details"].map((kind) => ({ kind, label: kind }));

export function runSheetFocus(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const scenario = (name: string, steps: Array<[string, (b: ReturnType<typeof mount>) => void, Picto[]]>) => {
    const bench = mount();
    const trace: unknown[] = [];
    for (const [label, fn, actions] of steps) {
      fn(bench);
      trace.push({ step: label, ...(snapshot(actions) as object), events: take() });
    }
    bench.unmount();
    out[name] = trace;
  };
  const focus = (b: ReturnType<typeof mount>, key: string, on = true) => b.run(() => (on ? latest?.store.binder(key)?.onFocus?.() : latest?.store.binder(key)?.onBlur?.()));

  scenario("note qui se résout, puis entrée à 5", [
    ["note en attente", (b) => b.render(<Probe rating={{ current: null, pending: true }} actions={PICTOS} entry={null} />), PICTOS],
    ["entrée décidée", (b) => b.render(<Probe rating={{ current: null }} actions={PICTOS} entry="sheet:scale:5" />), PICTOS],
    ["premier focus sur l'entrée", (b) => focus(b, "sheet:scale:5"), PICTOS],
    ["un autre cran", (b) => { focus(b, "sheet:scale:5", false); focus(b, "sheet:scale:4"); }, PICTOS],
    ["un picto visité", (b) => { focus(b, "sheet:scale:4", false); focus(b, "sheet:action:favorite"); }, PICTOS],
    ["note posée à 7", (b) => { focus(b, "sheet:action:favorite", false); focus(b, "sheet:scale:7"); b.render(<Probe rating={{ current: 7 }} actions={PICTOS} entry="sheet:scale:5" />); }, PICTOS],
  ]);
  scenario("note posée à l'ouverture, libérée par le filet", [
    ["entrée sur 8", (b) => b.render(<Probe rating={{ current: 8 }} actions={PICTOS} entry="sheet:scale:8" />), PICTOS],
    ["799 ms", (b) => b.advance(799), PICTOS],
    ["800 ms", (b) => b.advance(1), PICTOS],
  ]);
  scenario("rien à noter : entrée sur le premier picto", [
    ["entrée sur Lire", (b) => b.render(<Probe rating={null} actions={PICTOS} entry="sheet:action:play" />), PICTOS],
    ["premier focus", (b) => focus(b, "sheet:action:play"), PICTOS],
  ]);
  scenario("ni note ni picto : la croix", [
    ["entrée sur la croix", (b) => b.render(<Probe rating={null} actions={[]} entry="sheet:close" />), []],
    ["premier focus", (b) => focus(b, "sheet:close"), []],
  ]);
  return out;
}
