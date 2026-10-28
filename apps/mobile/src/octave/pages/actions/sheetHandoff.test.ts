import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdPresentedModal, retainModal } from "../../../components/ui/modalGate";
import { handOffSheet } from "./sheetHandoff";

describe("passage d'une feuille à la suivante", () => {
  let clock = Date.now();
  beforeEach(() => {
    clock += 3_600_000;
    vi.useFakeTimers({ now: clock });
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("la suivante attend que la première soit retirée, même après sa longue sortie", () => {
    // Le menu du titre est à l'écran (présenté par le natif).
    const sheet = holdPresentedModal();
    sheet.shown();
    const open = vi.fn();
    const close = vi.fn();
    handOffSheet(close, open);
    expect(close).toHaveBeenCalledTimes(1);
    // L'ancien délai fixe (380 ms) est dépassé : la feuille sort encore, rien ne s'ouvre.
    vi.advanceTimersByTime(590);
    expect(open).not.toHaveBeenCalled();
    // Démontée (fin de sortie) : la suivante s'ouvre, une fois le natif apaisé.
    sheet.release();
    vi.advanceTimersByTime(100);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("sans feuille à l'écran : la suivante s'ouvre aussitôt", () => {
    const open = vi.fn();
    handOffSheet(() => undefined, open);
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("une passe plus récente annule la précédente", () => {
    const release = retainModal();
    const first = vi.fn();
    const second = vi.fn();
    handOffSheet(() => undefined, first);
    handOffSheet(() => undefined, second);
    release();
    vi.advanceTimersByTime(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
