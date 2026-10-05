import { describe, expect, it } from "vitest";
import { closeAllSetupSessions, openSetupSession, touchSetupSession } from "./setupSession";

const HOUR = 60 * 60 * 1000;

describe("sessions de l'assistant", () => {
  it("valable une heure glissante", () => {
    closeAllSetupSessions();
    const id = openSetupSession(0);
    expect(touchSetupSession(id, HOUR - 1)).toBe(true);
    // L'heure est repartie au dernier appel.
    expect(touchSetupSession(id, 2 * HOUR - 2)).toBe(true);
    expect(touchSetupSession(id, 4 * HOUR)).toBe(false);
    // Expirée, elle est oubliée.
    expect(touchSetupSession(id, 0)).toBe(false);
  });

  it("refuse l'absent, l'inconnu, le malformé", () => {
    closeAllSetupSessions();
    expect(touchSetupSession(undefined)).toBe(false);
    expect(touchSetupSession(["a"])).toBe(false);
    expect(touchSetupSession("x".repeat(43))).toBe(false);
    expect(touchSetupSession("court")).toBe(false);
  });

  it("trois au plus : la plus ancienne cède sa place", () => {
    closeAllSetupSessions();
    const [a, b, c, d] = [openSetupSession(0), openSetupSession(0), openSetupSession(0), openSetupSession(0)];
    expect(touchSetupSession(a, 1)).toBe(false);
    for (const id of [b, c, d]) expect(touchSetupSession(id, 1)).toBe(true);
  });

  it("l'installation finie les ferme toutes", () => {
    const id = openSetupSession();
    closeAllSetupSessions();
    expect(touchSetupSession(id)).toBe(false);
  });
});
