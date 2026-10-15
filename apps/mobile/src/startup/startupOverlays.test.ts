import { afterEach, describe, expect, it, vi } from "vitest";
import {
  busyStartupOverlays,
  holdStartupOverlay,
  reportStartupOverlay,
  resetStartupOverlays,
  startupOverlaysQuiet,
  startupOverlaysQuietBefore,
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

  it("les tardifs passent dans l'ordre : avatars, puis code PIN — chacun n'attend que ceux d'avant", () => {
    reportStartupOverlay("family", "active");
    expect(startupOverlaysQuietBefore("avatars")).toBe(false);
    expect(startupOverlaysQuietBefore("familyPin")).toBe(false);
    reportStartupOverlay("family", "quiet");

    reportStartupOverlay("avatars", "active");
    reportStartupOverlay("familyPin", "pending");
    // L'invitation aux avatars n'attend ni elle-même ni le code PIN.
    expect(startupOverlaysQuietBefore("avatars")).toBe(true);
    expect(startupOverlaysQuietBefore("familyPin")).toBe(false);
    expect(startupOverlaysQuiet()).toBe(false);

    reportStartupOverlay("avatars", "quiet");
    expect(startupOverlaysQuietBefore("familyPin")).toBe(true);
  });

  it("un recouvrement ordinaire n'attend jamais les tardifs", () => {
    reportStartupOverlay("familyPin", "active");
    reportStartupOverlay("avatars", "active");
    expect(startupOverlaysQuietBefore("notices")).toBe(true);
  });
});
