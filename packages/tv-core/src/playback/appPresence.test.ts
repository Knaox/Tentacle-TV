import { describe, expect, it } from "vitest";

import { presenceOf, presenceStep } from "./appPresence";

describe("le lecteur quand l'app change de présence", () => {
  it("met en pause et garde la session au centre de contrôle", () => {
    const step = presenceStep("active", "inactive");
    expect(step.pause).toBe(true);
    // La position part ; l'arrêt, non : le transcodage et la session survivent.
    expect(step.report).toBe("position");
  });

  it("arrête la session quand l'app est quittée, depuis l'écran comme depuis l'inactivité", () => {
    for (const from of ["active", "inactive"] as const) {
      const step = presenceStep(from, "background");
      expect(step).toMatchObject({ pause: true, report: "stop" });
    }
  });

  it("rouvre la session, rend le focus à Lecture et contrôle le flux au retour d'une absence", () => {
    expect(presenceStep("background", "active")).toEqual({
      pause: false, report: "reopen", focusPlay: true, checkStream: true,
    });
  });

  it("ne rouvre rien au retour du centre de contrôle, mais rend le focus à Lecture", () => {
    expect(presenceStep("inactive", "active")).toEqual({
      pause: false, report: "none", focusPlay: true, checkStream: false,
    });
  });

  it("ne fait rien sans changement, ni pour un passage d'arrière-plan à inactif", () => {
    for (const p of ["active", "inactive", "background"] as const) {
      expect(presenceStep(p, p)).toEqual({ pause: false, report: "none", focusPlay: false, checkStream: false });
    }
    expect(presenceStep("background", "inactive").report).toBe("none");
  });

  it("ignore les états qu'AppState peut rendre sans qu'ils disent une présence", () => {
    expect(presenceOf("unknown")).toBeNull();
    expect(presenceOf("extension")).toBeNull();
    expect(presenceOf("background")).toBe("background");
  });
});
