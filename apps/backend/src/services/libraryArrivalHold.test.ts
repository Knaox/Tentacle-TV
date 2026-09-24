/**
 * L'attente des arrivées : une saison rangée en plusieurs vagues doit partir
 * en UNE annonce, sans qu'une importation sans fin n'étouffe tout ; un item
 * disparu avant l'annonce sort de l'attente ; les métadonnées ont un délai.
 */

import { describe, expect, it } from "vitest";
import { ArrivalHold, MAX_HOLD_MS, METADATA_WAIT_MS, SETTLE_MS } from "./libraryArrivalHold";

const T0 = 1_000_000;

describe("attente des arrivées", () => {
  it("rien en attente : ni échéance, ni relâche", () => {
    const hold = new ArrivalHold();
    expect(hold.nextCheckAt()).toBeNull();
    expect(hold.isSettled(T0)).toBe(false);
  });

  it("relâche quand la bibliothèque s'est tue SETTLE_MS", () => {
    const hold = new ArrivalHold();
    hold.observe(["a", "b"], T0);
    expect(hold.isSettled(T0 + SETTLE_MS - 1)).toBe(false);
    expect(hold.isSettled(T0 + SETTLE_MS)).toBe(true);
  });

  it("une seconde vague repousse l'échéance : la saison part d'un bloc", () => {
    const hold = new ArrivalHold();
    hold.observe(["e1", "e2"], T0);
    hold.observe(["e1", "e2", "e3"], T0 + 30_000);
    expect(hold.isSettled(T0 + SETTLE_MS)).toBe(false);
    expect(hold.nextCheckAt()).toBe(T0 + 30_000 + SETTLE_MS);
    expect(hold.ids().sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("une importation sans fin est relâchée au bout de MAX_HOLD_MS", () => {
    const hold = new ArrivalHold();
    for (let t = 0; t <= MAX_HOLD_MS; t += 30_000) {
      hold.observe([...hold.ids(), `x${t}`], T0 + t);
    }
    expect(hold.isSettled(T0 + MAX_HOLD_MS)).toBe(true);
  });

  it("un ID disparu avant l'annonce sort de l'attente", () => {
    const hold = new ArrivalHold();
    hold.observe(["tmp", "keep"], T0);
    hold.observe(["keep"], T0 + 10_000);
    expect(hold.ids()).toEqual(["keep"]);
    // Sa date de première vue ne bouge pas : l'échéance reste celle de T0.
    expect(hold.nextCheckAt()).toBe(T0 + SETTLE_MS);
  });

  it("les métadonnées ont METADATA_WAIT_MS depuis la détection", () => {
    const hold = new ArrivalHold();
    hold.observe(["m"], T0);
    expect(hold.canWait("m", T0 + METADATA_WAIT_MS - 1)).toBe(true);
    expect(hold.canWait("m", T0 + METADATA_WAIT_MS)).toBe(false);
    expect(hold.canWait("inconnu", T0)).toBe(false);
  });

  it("relâcher vide l'attente", () => {
    const hold = new ArrivalHold();
    hold.observe(["a", "b"], T0);
    hold.release(["a"]);
    expect(hold.ids()).toEqual(["b"]);
    hold.release(["b"]);
    expect(hold.size).toBe(0);
    expect(hold.nextCheckAt()).toBeNull();
  });
});
