import { describe, expect, it } from "vitest";

import { railContentHeight, railMaxOffset, railRevealOffset, railThumb, type RailScrollGeometry } from "./railScroll";

// La géométrie du rail d'Apple TV : entrées de 64, pas de 72, 685 visibles.
const G: RailScrollGeometry = { viewport: 685, item: 64, pitch: 72, padTop: 8, padBottom: 8, comfort: 84 };

describe("la hauteur du contenu", () => {
  it("compte les entrées, leurs écarts et les marges", () => {
    expect(railContentHeight(0, G)).toBe(16);
    expect(railContentHeight(1, G)).toBe(80);
    expect(railContentHeight(25, G)).toBe(8 + 24 * 72 + 64 + 8);
  });

  it("ne défile pas quand tout tient", () => {
    expect(railMaxOffset(8, G)).toBe(0);
    expect(railMaxOffset(25, G)).toBe(railContentHeight(25, G) - 685);
  });
});

describe("railRevealOffset — l'entrée focalisée, jamais au ras du bord", () => {
  const count = 28;

  it("ne bouge pas tant que l'entrée est dans la zone de confort", () => {
    expect(railRevealOffset(3, 0, count, G)).toBe(0);
    expect(railRevealOffset(9, 144, count, G)).toBe(144);
  });

  it("en descendant, garde une voisine entière sous l'entrée visée", () => {
    const offset = railRevealOffset(8, 0, count, G);
    const bottom = 8 + 8 * 72 + 64 - offset;
    expect(bottom).toBe(685 - 84);
    // La voisine du dessous tient entière dans la liste.
    expect(bottom + 8 + 64).toBeLessThanOrEqual(685);
  });

  it("en remontant, garde une voisine entière au-dessus", () => {
    const offset = railRevealOffset(10, 900, count, G);
    expect(8 + 10 * 72 - offset).toBe(84);
  });

  it("la première entrée ramène la liste en haut, la dernière en bas", () => {
    expect(railRevealOffset(0, 500, count, G)).toBe(0);
    expect(railRevealOffset(count - 1, 0, count, G)).toBe(railMaxOffset(count, G));
  });

  it("un index hors liste ne fait que borner", () => {
    expect(railRevealOffset(-1, 99999, count, G)).toBe(railMaxOffset(count, G));
    expect(railRevealOffset(40, -20, count, G)).toBe(0);
  });

  it("une liste qui tient ne défile jamais", () => {
    expect(railRevealOffset(7, 0, 8, G)).toBe(0);
  });
});

describe("railThumb — l'indicateur de position", () => {
  it("rien quand tout tient", () => {
    expect(railThumb(8, G, 669)).toBeNull();
  });

  it("proportionnel à la part visible, avec sa course", () => {
    const thumb = railThumb(28, G, 669);
    expect(thumb).not.toBeNull();
    expect(thumb!.size).toBe(Math.round((669 * 685) / railContentHeight(28, G)));
    expect(thumb!.size + thumb!.travel).toBe(669);
  });

  it("jamais plus petit que le plancher, même avec cent entrées", () => {
    expect(railThumb(100, G, 669)!.size).toBe(Math.max(36, Math.round((669 * 685) / railContentHeight(100, G))));
    expect(railThumb(1000, G, 669)!.size).toBe(36);
  });
});
