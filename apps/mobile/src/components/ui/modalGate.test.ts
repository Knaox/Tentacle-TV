import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENT_TIMEOUT_MS, holdPresentedModal, modalsOpen, retainModal, whenNoModal } from "./modalGate";

describe("modalGate", () => {
  // Une horloge qui avance d'un test à l'autre : le portier retient l'heure de la dernière sortie.
  let clock = Date.now();
  beforeEach(() => { clock += 3_600_000; vi.useFakeTimers({ now: clock }); });
  afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); });

  it("une ouverture attend que la modale montée soit retirée", () => {
    const release = retainModal();
    const run = vi.fn();
    whenNoModal(run);
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
    release();
    vi.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("une sortie « slide » annoncée est attendue, même sans modale montée", () => {
    retainModal(450)();
    const run = vi.fn();
    whenNoModal(run);
    vi.advanceTimersByTime(440);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("une modale jamais présentée par le natif ne retient pas le portier pour toujours", () => {
    const hold = holdPresentedModal();
    const run = vi.fn();
    whenNoModal(run);
    vi.advanceTimersByTime(PRESENT_TIMEOUT_MS + 100);
    expect(modalsOpen()).toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
    hold.release(); // idempotent : rien ne repasse sous zéro
    expect(modalsOpen()).toBe(0);
  });

  it("une modale présentée (onShow) retient le portier jusqu'à sa fermeture", () => {
    const hold = holdPresentedModal();
    hold.shown();
    const run = vi.fn();
    whenNoModal(run);
    vi.advanceTimersByTime(PRESENT_TIMEOUT_MS * 4);
    expect(modalsOpen()).toBe(1);
    expect(run).not.toHaveBeenCalled();
    hold.release();
    vi.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
