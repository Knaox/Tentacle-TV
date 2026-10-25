import { describe, expect, it } from "vitest";
import { FIRST_VISIT_HINT_KEY, firstVisitHintDue, markFirstVisitSeen, readFirstVisitSeen } from "./firstVisitHint";

/** Octave — le repère de la première visite : une fois par appareil, jamais par-dessus un recouvrement. */

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

describe("repère de la première visite", () => {
  it("paraît une fois, quand le démarrage s'est tu et qu'aucune feuille n'est ouverte", () => {
    expect(firstVisitHintDue({ seen: false, startupQuiet: true, overlayOpen: false })).toBe(true);
    expect(firstVisitHintDue({ seen: true, startupQuiet: true, overlayOpen: false })).toBe(false);
  });

  it("jamais par-dessus une fenêtre du démarrage ou une feuille modale", () => {
    expect(firstVisitHintDue({ seen: false, startupQuiet: false, overlayOpen: false })).toBe(false);
    expect(firstVisitHintDue({ seen: false, startupQuiet: true, overlayOpen: true })).toBe(false);
  });

  it("vu est retenu par l'appareil ; sans stockage lisible, il ne paraît pas", () => {
    const storage = memoryStorage();
    expect(readFirstVisitSeen(storage)).toBe(false);
    markFirstVisitSeen(storage);
    expect(storage.getItem(FIRST_VISIT_HINT_KEY)).toBe("1");
    expect(readFirstVisitSeen(storage)).toBe(true);
    expect(readFirstVisitSeen(null)).toBe(true);
    const broken = { getItem: () => { throw new Error("bloqué"); } };
    expect(readFirstVisitSeen(broken)).toBe(true);
  });
});
