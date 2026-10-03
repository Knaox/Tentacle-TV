import { describe, expect, it } from "vitest";
import { OFFLINE_VEIL_FOCUS, OFFLINE_VEIL_KEYS, SCREEN_ERROR_FOCUS } from "./overlayFocus";

describe("le voile hors ligne", () => {
  it("entre par Réessayer, retient le focus et laisse Menu à la plateforme", () => {
    expect(OFFLINE_VEIL_FOCUS.entry).toBe("offline:retry");
    expect(OFFLINE_VEIL_KEYS).toContain(OFFLINE_VEIL_FOCUS.entry);
    expect(OFFLINE_VEIL_FOCUS.trapped).toBe(true);
    expect(OFFLINE_VEIL_FOCUS.takesBack).toBe(false);
  });
});

describe("l'erreur d'un écran", () => {
  it("entre par Réessayer, jamais par la croix", () => {
    expect(SCREEN_ERROR_FOCUS.entry).toBe("screenError:retry");
    expect(SCREEN_ERROR_FOCUS.entry).not.toBe(SCREEN_ERROR_FOCUS.back);
  });
});
