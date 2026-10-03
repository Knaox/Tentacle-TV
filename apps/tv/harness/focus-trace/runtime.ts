import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * L'outillage du banc de traces du focus : une horloge factice (minuteurs et
 * `Date.now` sous la main du banc), des nœuds natifs factices qui relèvent ce
 * qu'on leur pose, un montage React sans DOM, et la trace.
 */

type Timer = { id: number; at: number; run: () => void };

const bench = globalThis as unknown as {
  IS_REACT_ACT_ENVIRONMENT: boolean;
  window: unknown;
  __appState: { current: string; listeners: Set<(state: string) => void> };
  __screen: { focused: boolean; listeners: Set<(focused: boolean) => void> };
  __emit: (event: unknown) => void;
};
bench.IS_REACT_ACT_ENVIRONMENT = true;
bench.window = globalThis;

let now = 1_000_000;
let nextId = 1;
const timers = new Map<number, Timer>();

globalThis.setTimeout = ((run: () => void, ms = 0) => {
  const id = nextId++;
  timers.set(id, { id, at: now + Math.max(0, ms), run });
  return id;
}) as unknown as typeof setTimeout;
globalThis.clearTimeout = ((id: number | undefined) => {
  if (id !== undefined) timers.delete(id);
}) as unknown as typeof clearTimeout;
Date.now = () => now;

/** Le temps du banc (ms). */
export const clock = () => now;

/** Avance l'horloge : chaque minuteur échu part à son heure, dans l'ordre. */
export function advance(ms: number): void {
  const end = now + ms;
  for (;;) {
    let due: Timer | null = null;
    for (const timer of timers.values()) if (timer.at <= end && (!due || timer.at < due.at || (timer.at === due.at && timer.id < due.id))) due = timer;
    if (!due) break;
    timers.delete(due.id);
    now = due.at;
    act(() => due!.run());
  }
  now = end;
}

/** Remet l'horloge et les minuteurs à zéro entre deux scénarios. */
export function resetClock(): void {
  timers.clear();
  now = 1_000_000;
}

export type Trace = unknown[];
let trace: Trace = [];
export const record = (...entry: unknown[]) => trace.push([now - 1_000_000, ...entry]);
export function takeTrace(): Trace {
  const taken = trace;
  trace = [];
  return taken;
}

let handles = 100;
/** Un nœud natif factice : il relève ce qu'on lui pose, et a son numéro. */
export function fakeNode(name: string) {
  const handle = handles++;
  const node = {
    __handle: handle,
    __name: name,
    setNativeProps: (props: Record<string, unknown>) => record("native", name, readable(props)),
    requestTVFocus: () => record("requestTVFocus", name),
  };
  names.set(handle, name);
  return node;
}
const names = new Map<number, string>();
/** Les numéros natifs remplacés par le nom de leur nœud, pour une trace lisible et stable. */
export function readable(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) out[key] = typeof value === "number" && names.has(value) ? `#${names.get(value)}` : value;
  return out;
}

function fakeContainer() {
  const listen = { addEventListener() {}, removeEventListener() {} };
  const document = { nodeType: 9, activeElement: null, ...listen, defaultView: { HTMLIFrameElement: class {}, ...listen } } as Record<string, unknown>;
  (document.defaultView as Record<string, unknown>).document = document;
  return { nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: document, ...listen } as unknown as Element;
}

/** Monte un élément ; rend de quoi le redessiner et le démonter. */
export function mount(element: ReactElement) {
  const root: Root = createRoot(fakeContainer());
  act(() => root.render(element));
  return {
    render: (next: ReactElement) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
}

/** Exécute une action dans `act` (effets et rendus compris). */
export const step = (run: () => void) => act(run);

/** Un événement natif de la télécommande, tel que TVEventHandler le livre. */
export function emit(eventType: string, eventKeyAction?: number): void {
  act(() => bench.__emit(eventKeyAction === undefined ? { eventType } : { eventType, eventKeyAction }));
}

/** L'écran passe devant (`true`) ou derrière. */
export function screenFocused(focused: boolean): void {
  bench.__screen.focused = focused;
  act(() => {
    for (const listener of [...bench.__screen.listeners]) listener(focused);
  });
}

/** L'application devient active ou non. */
export function appState(state: string): void {
  bench.__appState.current = state;
  act(() => {
    for (const listener of [...bench.__appState.listeners]) listener(state);
  });
}
