import { afterEach, describe, expect, it, vi } from "vitest";
import { forget, hasMemory, remember } from "./memory";

/**
 * `memory.ts` ne lit le document qu'à l'appel : l'adresse courante, et la
 * présence d'une surcouche. Des doublures suffisent — il n'y a rien à rendre.
 */
function visit(pathname: string): void {
  vi.stubGlobal("window", { location: { pathname } });
  vi.stubGlobal("document", { querySelector: () => null });
}

/** Un bouton hors rail et hors surcouche, reconnu par son libellé accessible. */
function button(label: string): HTMLElement {
  return {
    tagName: "BUTTON",
    closest: () => null,
    getAttribute: (name: string) => (name === "aria-label" ? label : null),
    textContent: "",
  } as unknown as HTMLElement;
}

describe("mémoire de route", () => {
  afterEach(() => {
    forget();
    vi.unstubAllGlobals();
  });

  it("retient où l'on était sur un écran ordinaire", () => {
    visit("/tv/media/050252a1ec1cb92ad13bf575a6cdc8ac");
    remember(button("Lecture"));
    expect(hasMemory()).toBe(true);
  });

  it("ne retient rien du lecteur, écran d'attente compris", () => {
    // Le « Retour » de l'écran d'attente, focalisé d'office : sa clé est celle
    // de la sortie de l'habillage, qui l'aurait retrouvée à sa place.
    visit("/tv/watch/db4c1708cbb5dd1676284a40f2950aba");
    remember(button("Retour"));
    expect(hasMemory()).toBe(false);
  });

  it("retient Ma liste, que le lecteur ne doit pas avaler", () => {
    visit("/tv/watchlist");
    remember(button("Tout"));
    expect(hasMemory()).toBe(true);
  });
});
