import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { StartupWindow, StartupWindowState } from "./startupOrder";
import { readStartupSnapshot, resetStartupWindows, setStartupReady, useStartupTurn } from "./startupStore";

// React sans DOM, comme les bancs de la recherche (`useHeldSearchView.test.ts`).
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

interface Gate { target: StartupWindow; state: StartupWindowState }

/** Des portes montées ensemble : `turns` dit, après chaque rendu, laquelle a son tour. */
function mount(initial: Gate[]) {
  const turns: Partial<Record<StartupWindow, boolean>> = {};
  function Probe({ target, state }: Gate) {
    turns[target] = useStartupTurn(target, state);
    return null;
  }
  let root: Root | null = null;
  const render = (gates: Gate[]) => act(() => {
    root ??= createRoot(container() as never);
    root.render(gates.map((gate) => createElement(Probe, { key: gate.target, ...gate })));
  });
  render(initial);
  return { turns, render, unmount: () => act(() => root?.unmount()) };
}

afterEach(resetStartupWindows);

describe("les portes du démarrage, montées", () => {
  it("le PIN conseillé, puis les nouveautés, puis l'avatar — chacun à son tour", () => {
    act(() => setStartupReady(true));
    const { turns, render, unmount } = mount([
      { target: "avatarInvite", state: "pending" },
      { target: "whatsNew", state: "undecided" },
      { target: "familyPin", state: "pending" },
    ]);
    expect(turns).toEqual({ familyPin: true, whatsNew: false, avatarInvite: false });

    // Le PIN s'ouvre : personne d'autre.
    render([{ target: "avatarInvite", state: "pending" }, { target: "whatsNew", state: "undecided" }, { target: "familyPin", state: "open" }]);
    expect(turns).toEqual({ familyPin: true, whatsNew: false, avatarInvite: false });

    // Refermé : les nouveautés tranchent, et s'ouvrent.
    render([{ target: "avatarInvite", state: "pending" }, { target: "whatsNew", state: "undecided" }, { target: "familyPin", state: "done" }]);
    expect(turns.whatsNew).toBe(true);
    expect(turns.avatarInvite).toBe(false);
    render([{ target: "avatarInvite", state: "pending" }, { target: "whatsNew", state: "open" }, { target: "familyPin", state: "done" }]);
    expect(turns.avatarInvite).toBe(false);

    // Les nouveautés refermées : l'avatar.
    render([{ target: "avatarInvite", state: "pending" }, { target: "whatsNew", state: "done" }, { target: "familyPin", state: "done" }]);
    expect(turns.avatarInvite).toBe(true);
    unmount();
  });

  it("une porte démontée se retire du magasin", () => {
    act(() => setStartupReady(true));
    const { unmount } = mount([{ target: "familyInvitation", state: "pending" }]);
    expect(readStartupSnapshot().states.familyInvitation).toBe("pending");
    unmount();
    expect(readStartupSnapshot().states.familyInvitation).toBeUndefined();
  });

  it("le rideau d'un profil retient tout le monde jusqu'à sa levée", () => {
    act(() => setStartupReady(true));
    const { turns, render, unmount } = mount([{ target: "profile", state: "open" }, { target: "whatsNew", state: "undecided" }]);
    expect(turns.whatsNew).toBe(false);
    render([{ target: "profile", state: "done" }, { target: "whatsNew", state: "undecided" }]);
    expect(turns.whatsNew).toBe(true);
    unmount();
  });
});
