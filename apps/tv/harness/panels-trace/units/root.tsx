import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { advance as advanceClock, resetClock } from "../stubs/clock";
import { events, hosts } from "../stubs/record";

/**
 * Le montage sans DOM : react-dom 19 sur un conteneur factice, chaque geste
 * dans `act`. Une unité rend, agit, puis relève ce qui s'est passé (`take`).
 */

const g = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean; window: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
// react-dom lit `window.event` : le banc n'a pas de fenêtre, il en tient lieu.
g.window = globalThis;

function fakeContainer(): Element {
  const listen = { addEventListener() {}, removeEventListener() {} };
  const document = { nodeType: 9, activeElement: null, ...listen, defaultView: { HTMLIFrameElement: class {}, ...listen } } as Record<string, unknown>;
  (document.defaultView as Record<string, unknown>).document = document;
  return { nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: document, addEventListener() {}, removeEventListener() {} } as unknown as Element;
}

export interface Bench {
  render(element: ReactElement): void;
  /** Un geste, dans `act`. */
  run(fn: () => void): void;
  /** L'horloge avance de `ms` (les filets). */
  advance(ms: number): void;
  unmount(): void;
}

export function mount(): Bench {
  resetClock();
  hosts.clear();
  events.length = 0;
  const root: Root = createRoot(fakeContainer());
  return {
    render: (element) => act(() => root.render(element)),
    run: (fn) => act(fn),
    advance: (ms) => advanceClock(ms, (fn) => act(fn)),
    unmount: () => act(() => root.unmount()),
  };
}

/** Les événements notés depuis le dernier relevé, et l'on repart de zéro. */
export function take(): unknown[] {
  const out = events.slice();
  events.length = 0;
  return out;
}
