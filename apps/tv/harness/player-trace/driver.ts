// Le pilote du banc : monte le lecteur, envoie les gestes (tels que tvOS ou
// Android les émettent), avance l'horloge factice un minuteur à la fois — React
// rend entre deux, comme sur l'appareil — et rend la trace.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import { __back } from "./mocks/BackScope";
import { __nav } from "./mocks/navigation";
import { __rig } from "./mocks/react-native";
import { envStore, rigApi, rigElement, trace, type Entry, type RigEnv } from "./rig";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

let root: Root | null = null;

/** Un pas du scénario. */
export type Step =
  | { key: string; a?: number }                 // événement télécommande brut (eventType, eventKeyAction)
  | { pan: "Began" | "Changed" | "Ended"; x: number; y?: number; vx?: number; vy?: number }
  | { menu: true }                               // Menu tvOS : la portée du Retour
  | { androidBack: true }                        // Retour Android : BackHandler
  | { button: string; twin?: "after" | "before" | "none" } // OK sur un bouton de l'habillage (+ « select » global)
  | { wait: number }
  | { patch: Partial<RigEnv> };

export interface Scenario {
  id: string;
  title: string;
  platform?: "ios" | "android" | "both";
  env?: Partial<RigEnv>;
  steps: Step[];
}

async function flush(fn: () => void): Promise<void> {
  await act(async () => { fn(); });
}

/** Avance l'horloge de `ms`, un minuteur à la fois. */
async function wait(ms: number): Promise<void> {
  const end = Date.now() + ms;
  let reached = false;
  const sentinel = setTimeout(() => { reached = true; }, ms);
  void sentinel;
  let guard = 0;
  while (!reached) {
    await act(async () => { vi.advanceTimersToNextTimer(); });
    if (++guard > 100_000) throw new Error(`horloge emballée avant ${end}`);
  }
}

export async function run(scenario: Scenario): Promise<Entry[]> {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"], now: 1_000_000 });
  trace.t0 = Date.now();
  trace.entries = [];
  __back.reset();
  __rig.listeners.clear();
  __rig.backHandlers = [];
  __rig.panHolders = 0;
  __rig.onPan = (on) => trace.log(on ? "pan:on" : "pan:off");
  __nav.preventing = false;
  __nav.onChange = (on) => trace.log("preventRemove", on);
  envStore.reset(scenario.env ?? {});
  root = createRoot(container as never);
  await flush(() => root?.render(rigElement()));
  await wait(50);
  for (const step of scenario.steps) await play(step);
  await wait(50);
  await flush(() => root?.unmount());
  root = null;
  vi.useRealTimers();
  return trace.entries;
}

async function play(step: Step): Promise<void> {
  if ("wait" in step) return wait(step.wait);
  if ("patch" in step) {
    trace.log("in:patch", step.patch);
    return flush(() => envStore.patch(step.patch));
  }
  if ("key" in step) {
    trace.log("in:key", step.a === undefined ? step.key : `${step.key}/${step.a}`);
    return flush(() => __rig.dispatch({ eventType: step.key, eventKeyAction: step.a }));
  }
  if ("pan" in step) {
    const body = { state: step.pan, x: step.x, y: step.y ?? 0, velocityX: step.vx ?? 0, velocityY: step.vy ?? 0 };
    if (!__rig.panHolders) {
      trace.log("in:pan(ignoré, pan non tenu)", body);
      return;
    }
    trace.log("in:pan", body);
    return flush(() => __rig.dispatch({ eventType: "pan", body }));
  }
  if ("menu" in step) {
    trace.log("in:menu");
    return flush(() => __back.press());
  }
  if ("androidBack" in step) {
    trace.log("in:androidBack");
    return flush(() => { if (!__rig.androidBack()) trace.log("androidBack:système"); });
  }
  if ("button" in step) {
    const twin = step.twin ?? "after";
    trace.log("in:button", step.button);
    const press = () => (rigApi.actions?.[step.button] as (() => void) | undefined)?.();
    const select = () => __rig.dispatch({ eventType: "select", eventKeyAction: __rig.platform === "android" ? 0 : 1 });
    if (twin === "before") await flush(select);
    await flush(press);
    if (twin === "after") await flush(select);
    if (__rig.platform === "android" && twin !== "none") await flush(() => __rig.dispatch({ eventType: "select", eventKeyAction: 1 }));
  }
}
