/**
 * Les flèches d'une rangée (`useRowScroll`), montées pour de vrai (React, sans
 * DOM) : une rangée se monte avec sa cale de hauteur réservée, SANS ses cartes
 * — rien à défiler. Ses cartes arrivent ensuite SANS changer la taille de la
 * piste (la cale avait leur hauteur) : la flèche droite doit paraître quand
 * même — c'est l'ajout des enfants qui la remesure, pas un redimensionnement.
 * Défaut relevé sur « Pour vous » (web, bureau, lot 1017).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRowScroll, type RowScrollState } from "./useRowScroll";

const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = {
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
};

/** La piste : 1 432 px de large, ce qu'elle contient se lit dans `scrollWidth`. */
const track = { scrollLeft: 0, scrollWidth: 1432, clientWidth: 1432 };
let mutationCallbacks: Array<() => void> = [];
let resizeCallbacks: Array<() => void> = [];
let root: Root | null = null;
let probe: RowScrollState;

function Rig() {
  probe = useRowScroll();
  (probe.scrollRef as { current: unknown }).current ??= track;
  return null;
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  Object.assign(track, { scrollLeft: 0, scrollWidth: 1432, clientWidth: 1432 });
  mutationCallbacks = [];
  resizeCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => setTimeout(cb, 0) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  vi.stubGlobal("ResizeObserver", class {
    constructor(cb: () => void) { resizeCallbacks.push(cb); }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("MutationObserver", class {
    constructor(cb: () => void) { mutationCallbacks.push(cb); }
    observe() {}
    disconnect() {}
  });
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  vi.unstubAllGlobals();
});

async function mount() {
  root = createRoot(container as never);
  await act(async () => {
    root!.render(createElement(Rig));
  });
}

describe("useRowScroll — les flèches", () => {
  it("cartes montées après la cale, sans changement de taille : la flèche droite paraît", async () => {
    await mount();
    expect(probe.canScrollRight).toBe(false); // la cale seule : rien à défiler

    track.scrollWidth = 4984; // les cartes arrivent ; la boîte ne bouge pas
    await act(async () => {
      for (const cb of mutationCallbacks) cb();
      await nextFrame();
    });
    expect(probe.canScrollRight).toBe(true);
    expect(probe.canScrollLeft).toBe(false);
  });

  it("une rafale de changements ne fait qu'UNE mesure par image", async () => {
    await mount();
    const reads = vi.fn();
    Object.defineProperty(track, "scrollWidth", { configurable: true, get: () => (reads(), 4984) });
    await act(async () => {
      for (let i = 0; i < 5; i += 1) for (const cb of [...mutationCallbacks, ...resizeCallbacks]) cb();
      await nextFrame();
    });
    expect(reads).toHaveBeenCalledTimes(1);
    expect(probe.canScrollRight).toBe(true);
    Object.defineProperty(track, "scrollWidth", { configurable: true, writable: true, value: 1432 });
  });
});
