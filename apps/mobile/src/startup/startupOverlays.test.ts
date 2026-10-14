import { afterEach, describe, expect, it, vi } from "vitest";
import {
  busyStartupOverlays,
  holdStartupOverlay,
  reportStartupOverlay,
  resetStartupOverlays,
  startupOverlaysQuiet,
  subscribeStartupOverlays,
} from "./startupOverlays";

afterEach(() => resetStartupOverlays());

describe("les recouvrements du démarrage", () => {
  it("rien de déclaré : tout est tu", () => {
    expect(startupOverlaysQuiet()).toBe(true);
    expect(busyStartupOverlays()).toEqual([]);
  });

  it("un hôte qui n'a pas tranché, ou qui montre quelque chose, empêche le silence", () => {
    reportStartupOverlay("family", "pending");
    reportStartupOverlay("notices", "active");
    expect(startupOverlaysQuiet()).toBe(false);
    expect(busyStartupOverlays()).toEqual(["family", "notices"]);
    reportStartupOverlay("family", "quiet");
    expect(busyStartupOverlays()).toEqual(["notices"]);
    reportStartupOverlay("notices", "quiet");
    expect(startupOverlaysQuiet()).toBe(true);
  });

  it("une demande de permission tient le temps de l'opération, même relâchée deux fois", () => {
    const first = holdStartupOverlay("permission");
    const second = holdStartupOverlay("permission");
    first();
    first();
    expect(startupOverlaysQuiet()).toBe(false);
    second();
    expect(startupOverlaysQuiet()).toBe(true);
  });

  it("prévient les abonnés d'un changement, pas d'une redite", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStartupOverlays(listener);
    reportStartupOverlay("messages", "active");
    reportStartupOverlay("messages", "active");
    reportStartupOverlay("connectivity", "quiet");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
