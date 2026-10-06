import { describe, expect, it } from "vitest";
import { closeAllSetupSessions, openSetupSession, sessionHeldElsewhere, touchSetupSession } from "./setupSession";

const HOUR = 60 * 60 * 1000;
const IP = "192.168.1.20";

describe("sessions de l'assistant", () => {
  it("valable une heure glissante", () => {
    closeAllSetupSessions();
    const id = openSetupSession(IP, 0);
    expect(touchSetupSession(id, IP, HOUR - 1)).toBe(true);
    // L'heure est repartie au dernier appel.
    expect(touchSetupSession(id, IP, 2 * HOUR - 2)).toBe(true);
    expect(touchSetupSession(id, IP, 4 * HOUR)).toBe(false);
    // Expirée, elle est oubliée.
    expect(touchSetupSession(id, IP, 0)).toBe(false);
  });

  it("refuse l'absent, l'inconnu, le malformé", () => {
    closeAllSetupSessions();
    expect(touchSetupSession(undefined, IP)).toBe(false);
    expect(touchSetupSession(["a"], IP)).toBe(false);
    expect(touchSetupSession("x".repeat(43), IP)).toBe(false);
    expect(touchSetupSession("court", IP)).toBe(false);
  });

  it("trois au plus : la plus ancienne cède sa place", () => {
    closeAllSetupSessions();
    const [a, b, c, d] = [openSetupSession(IP, 0), openSetupSession(IP, 0), openSetupSession(IP, 0), openSetupSession(IP, 0)];
    expect(touchSetupSession(a, IP, 1)).toBe(false);
    for (const id of [b, c, d]) expect(touchSetupSession(id, IP, 1)).toBe(true);
  });

  it("l'installation finie les ferme toutes", () => {
    const id = openSetupSession(IP);
    closeAllSetupSessions();
    expect(touchSetupSession(id, IP)).toBe(false);
  });

  it("liée à l'adresse qui l'a ouverte : volée, elle ne sert à rien d'ailleurs", () => {
    closeAllSetupSessions();
    const id = openSetupSession(IP, 0);
    expect(touchSetupSession(id, "192.168.1.66", 1)).toBe(false);
    expect(touchSetupSession(id, IP, 1)).toBe(true);
    expect(sessionHeldElsewhere("192.168.1.66", 1)).toBe(true);
    expect(sessionHeldElsewhere(IP, 1)).toBe(false);
    expect(sessionHeldElsewhere("192.168.1.66", 2 * HOUR)).toBe(false);
  });
});
