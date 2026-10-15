import { afterEach, describe, expect, it, vi } from "vitest";
import { startupWindowMayShow } from "./startupOrder";
import {
  describeStartup,
  publishStartupWindow,
  readStartupSnapshot,
  resetStartupWindows,
  setStartupReady,
  subscribeStartup,
} from "./startupStore";

afterEach(resetStartupWindows);

const mayShow = (target: Parameters<typeof startupWindowMayShow>[0]) => {
  const { states, ready } = readStartupSnapshot();
  return startupWindowMayShow(target, states, ready);
};

describe("le magasin des fenêtres du démarrage", () => {
  it("rien sans session", () => {
    expect(mayShow("whatsNew")).toBe(false);
    setStartupReady(true);
    expect(mayShow("whatsNew")).toBe(true);
  });

  it("le profil a trois sources : la plus contraignante tient le démarrage", () => {
    setStartupReady(true);
    publishStartupWindow("profileLaunch", "profile", "undecided");
    publishStartupWindow("profileArrival", "profile", "open");
    expect(readStartupSnapshot().states.profile).toBe("open");
    publishStartupWindow("profileArrival", "profile", "done");
    expect(readStartupSnapshot().states.profile).toBe("undecided");
    expect(mayShow("familyPin")).toBe(false);
    publishStartupWindow("profileLaunch", "profile", null);
    expect(mayShow("familyPin")).toBe(true);
  });

  it("une porte démontée se retire : elle ne retient plus rien", () => {
    setStartupReady(true);
    publishStartupWindow("familyInvitation", "familyInvitation", "pending");
    expect(mayShow("whatsNew")).toBe(false);
    publishStartupWindow("familyInvitation", "familyInvitation", null);
    expect(mayShow("whatsNew")).toBe(true);
  });

  it("ne prévient que d'un vrai changement", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStartup(listener);
    publishStartupWindow("whatsNew", "whatsNew", "undecided");
    publishStartupWindow("whatsNew", "whatsNew", "undecided");
    setStartupReady(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("dit qui tient le démarrage (diagnostic)", () => {
    publishStartupWindow("familyPin", "familyPin", "pending");
    publishStartupWindow("whatsNew", "whatsNew", "undecided");
    expect(describeStartup().holder).toBe("familyPin");
  });
});
