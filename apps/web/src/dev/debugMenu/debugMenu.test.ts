import { describe, expect, it, vi } from "vitest";

// Les modules d'actions tirent le pont de bureau et le thème : remplacés, on ne juge ici que
// les règles pures (variantes par coquille, rapport en texte, catalogue).
vi.mock("../../desktop/detect", () => ({ desktopPlatform: () => "web", isDesktopApp: () => false }));
vi.mock("../../hooks/mpvRuntime", () => ({ getMpvApi: () => null, isMacOS: () => false, isWindows: () => false }));

const { updateDemoChoices } = await import("./debugUpdateDemo");
const { debugReport } = await import("./debugReport");
const { DEBUG_GROUPS } = await import("./debugActionTypes");
import type { DebugAction, DebugStatus } from "./debugActionTypes";

describe("la pop-up de mise à jour du menu de débogage : chaque coquille montre la sienne", () => {
  it("Electron et le navigateur : la pop-up du front, sans préfixe", () => {
    for (const kind of ["electron", "web"] as const) {
      const choices = updateDemoChoices(kind, true);
      expect(choices.every((c) => c.id.startsWith("front:"))).toBe(true);
      expect(choices.map((c) => c.label)).toEqual(["Disponible", "Téléchargement", "Installation", "Redémarrage", "Erreur"]);
    }
  });

  it("CEF sans mise à jour confiée au front (macOS, Linux) : sa surcouche seule", () => {
    const choices = updateDemoChoices("cef", false);
    expect(choices.every((c) => c.id.startsWith("shell:"))).toBe(true);
    expect(choices.map((c) => c.label)).toEqual(["Notification", "Prête", "Sécurité", "Installation", "Annulée", "Fermer"]);
  });

  it("CEF sous Windows (le Store passe par le front) : la surcouche ET la pop-up du front, dite « Store »", () => {
    const choices = updateDemoChoices("cef", true);
    expect(choices.filter((c) => c.id.startsWith("shell:"))).toHaveLength(6);
    const front = choices.filter((c) => c.id.startsWith("front:"));
    expect(front).toHaveLength(5);
    expect(front.every((c) => c.label.startsWith("Store · "))).toBe(true);
  });
});

describe("le diagnostic en texte", () => {
  const action = (id: string, key: string, label: string): DebugAction => ({ id, key, label, hint: "", group: "player", kind: "switch", run: async () => null });
  const actions = [action("a", "m", "Lecteur mpv coupé"), action("b", "p", "Passthrough HDR"), action("c", "n", "Nouveautés")];
  const statuses = new Map<string, DebugStatus>([
    ["a", { on: true }],
    ["b", { unavailable: "tenu par la coquille CEF" }],
  ]);
  const text = debugReport("CEF · Windows", [{ title: "Coquille", lines: [["shell", "cef", true], ["mises à jour", "absent", false]] }], actions, statuses);

  it("dit la coquille, l'état de chaque action et la raison d'une indisponibilité", () => {
    expect(text).toContain("diagnostic (CEF · Windows)");
    expect(text).toContain("[M] Lecteur mpv coupé : allumé");
    expect(text).toContain("[P] Passthrough HDR : indisponible — tenu par la coquille CEF");
    expect(text).toContain("[N] Nouveautés : disponible");
  });

  it("reprend chaque section, et marque ce qui est à voir", () => {
    expect(text).toContain("COQUILLE\n  shell : cef\n  mises à jour : absent   ← à voir");
  });
});

describe("le catalogue des actions", () => {
  it("une touche par action, chaque action dans un groupe connu", async () => {
    vi.doMock("../../desktop/bridge", () => ({ invoke: async () => { throw new Error("hors coquille"); } }));
    vi.doMock("../../desktop/capabilities", () => ({ supportsSurfaceProbe: () => false, supportsAppUpdates: () => false }));
    vi.doMock("../../theme/liquidGlass", () => ({ getLiquidGlass: () => false, setLiquidGlass: () => undefined }));
    vi.doMock("../../theme/liquidGlassMode", () => ({ nativeGlassBridge: () => null }));
    vi.doMock("../surfaceProbe", () => ({ probeSurface: async () => null, probeVerdict: () => "" }));
    vi.doMock("../networkProbe", () => ({ clearNetworkProbe: () => undefined, outgoingRequests: () => [] }));
    vi.doMock("../../lib/nativePlayer", () => ({ mpvDisabledByDebug: () => false, toggleMpvDebug: () => true }));
    vi.doMock("../../lib/hardwareDecoding", () => ({ hardwareDecodingChoice: () => "auto", setHardwareDecoding: () => undefined }));
    const { DEBUG_ACTIONS } = await import("../playerDebugActions");
    const keys = DEBUG_ACTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const groups = new Set(DEBUG_GROUPS.map((g) => g.id));
    expect(DEBUG_ACTIONS.every((a) => groups.has(a.group))).toBe(true);
    // Dans un navigateur, ce qui touche à mpv dit POURQUOI il ne peut pas agir — jamais un succès feint.
    const mpvOff = await DEBUG_ACTIONS.find((a) => a.id === "mpv-off")?.status?.();
    expect(mpvOff?.unavailable).toMatch(/navigateur/);
    const passthrough = await DEBUG_ACTIONS.find((a) => a.id === "passthrough")?.status?.();
    expect(passthrough?.unavailable).toMatch(/navigateur/);
  });
});
