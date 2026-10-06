import { describe, expect, it } from "vitest";
import {
  nextStep,
  pathEntry,
  pathForServer,
  previousStep,
  setupActionAllowed,
  setupFlowLength,
  setupFlowSteps,
  setupStage,
  type SetupAction,
  type SetupFlowShape,
  type SetupFlowState,
  type SetupPath,
  type SetupSelection,
  type SetupStep,
} from "./setupFlowContract";

const selection = (path: SetupPath, inStack = false): SetupSelection => ({
  url: inStack ? "http://jellyfin:8096" : "http://192.168.1.20:8096",
  serverId: "abc",
  serverName: "Salon",
  version: "10.11.6",
  inStack,
  path,
});
const state = (over: Partial<SetupFlowState> = {}): SetupFlowState => ({ databasePending: false, selection: null, linked: false, ...over });

/** Les installations : pile complète (base fournie), pile « base » (Jellyfin à côté), natif ou pile « seule » (base à relier), avec ou sans code. */
const SHAPES: Array<[string, Omit<SetupFlowShape, "path">]> = [
  ["pile complète, réseau local", { needsCode: false, asksDatabase: false }],
  ["pile complète, code", { needsCode: true, asksDatabase: false }],
  ["sans pile (base à relier), réseau local", { needsCode: false, asksDatabase: true }],
  ["sans pile (base à relier), code", { needsCode: true, asksDatabase: true }],
];

describe("les écrans de chaque parcours", () => {
  it("Jellyfin NEUF : compte créé, puis bibliothèques — jamais la connexion ni les réglages conseillés", () => {
    expect(setupFlowSteps({ needsCode: false, asksDatabase: false, path: "fresh" })).toEqual([
      "welcome", "jellyfin", "account", "libraries", "recap", "apply", "remote", "done",
    ]);
  });

  it("Jellyfin DÉJÀ configuré : connexion, puis réglages conseillés — jamais de compte créé ni de bibliothèques", () => {
    expect(setupFlowSteps({ needsCode: false, asksDatabase: false, path: "configured" })).toEqual([
      "welcome", "jellyfin", "signIn", "recommended", "recap", "apply", "remote", "done",
    ]);
  });

  it.each(SHAPES)("%s : l'étape « Jellyfin » est toujours là, juste avant le parcours, et jamais sautée", (_name, shape) => {
    for (const path of [null, "fresh", "configured"] as const) {
      const steps = setupFlowSteps({ ...shape, path });
      expect(steps).toContain("jellyfin");
      expect(steps.filter((s) => s === "jellyfin")).toHaveLength(1);
      expect(steps.includes("code")).toBe(shape.needsCode);
      expect(steps.includes("database")).toBe(shape.asksDatabase);
      if (path) expect(steps[steps.indexOf("jellyfin") + 1]).toBe(pathEntry(path));
    }
  });

  it.each(SHAPES)("%s : les deux parcours ont la longueur annoncée avant même le choix", (_name, shape) => {
    const total = setupFlowLength({ ...shape, path: null });
    expect(setupFlowSteps({ ...shape, path: "fresh" })).toHaveLength(total);
    expect(setupFlowSteps({ ...shape, path: "configured" })).toHaveLength(total);
    // Sans choix, rien au-delà de « Jellyfin » : aucun écran d'un parcours deviné.
    expect(setupFlowSteps({ ...shape, path: null }).at(-1)).toBe("jellyfin");
  });

  it("aucun écran n'appartient aux deux parcours entre « Jellyfin » et le récapitulatif", () => {
    const fresh = setupFlowSteps({ needsCode: true, asksDatabase: true, path: "fresh" });
    const configured = setupFlowSteps({ needsCode: true, asksDatabase: true, path: "configured" });
    for (const step of ["account", "libraries"] as const) expect(configured).not.toContain(step);
    for (const step of ["signIn", "recommended"] as const) expect(fresh).not.toContain(step);
  });

  it("le parcours d'un Jellyfin sondé : vierge → neuf, sinon déjà configuré", () => {
    expect(pathForServer({ blank: true })).toBe("fresh");
    expect(pathForServer({ blank: false })).toBe("configured");
  });
});

describe("le retour en arrière ne remonte que dans le parcours", () => {
  const walkBack = (steps: SetupStep[], from: SetupStep): SetupStep[] => {
    const seen: SetupStep[] = [from];
    for (let step = previousStep(steps, from); step; step = previousStep(steps, step)) seen.push(step);
    return seen;
  };

  it.each(SHAPES)("%s : depuis le récapitulatif, chaque écran d'avant du parcours, et rien d'autre", (_name, shape) => {
    for (const path of ["fresh", "configured"] as const) {
      const steps = setupFlowSteps({ ...shape, path });
      const back = walkBack(steps, "recap");
      expect(back).toEqual(steps.slice(0, steps.indexOf("recap") + 1).reverse());
      const other = path === "fresh" ? ["signIn", "recommended"] : ["account", "libraries"];
      for (const step of other) expect(back).not.toContain(step);
    }
  });

  it("aucun retour depuis l'accueil, l'installation, l'accès à distance ni la fin", () => {
    const steps = setupFlowSteps({ needsCode: true, asksDatabase: true, path: "fresh" });
    for (const step of ["welcome", "apply", "remote", "done"] as const) expect(previousStep(steps, step)).toBeNull();
  });

  it("un écran d'un autre parcours n'a ni avant ni après", () => {
    const steps = setupFlowSteps({ needsCode: false, asksDatabase: false, path: "configured" });
    expect(previousStep(steps, "libraries")).toBeNull();
    expect(nextStep(steps, "account")).toBeNull();
  });

  it("l'écran d'après suit l'ordre, et s'arrête à la fin", () => {
    const steps = setupFlowSteps({ needsCode: false, asksDatabase: false, path: "fresh" });
    expect(nextStep(steps, "jellyfin")).toBe("account");
    expect(nextStep(steps, "libraries")).toBe("recap");
    expect(nextStep(steps, "done")).toBeNull();
  });
});

describe("l'étape du serveur (où reprendre)", () => {
  it("la base d'abord, puis TOUJOURS le choix du Jellyfin", () => {
    expect(setupStage(state({ databasePending: true, selection: selection("configured"), linked: true }))).toBe("database");
    expect(setupStage(state())).toBe("jellyfin");
  });

  it.each([true, false])("pile complète = %s : le parcours choisi, puis son second écran une fois relié", (inStack) => {
    expect(setupStage(state({ selection: selection("fresh", inStack) }))).toBe("account");
    expect(setupStage(state({ selection: selection("fresh", inStack), linked: true }))).toBe("libraries");
    expect(setupStage(state({ selection: selection("configured", inStack) }))).toBe("signIn");
    expect(setupStage(state({ selection: selection("configured", inStack), linked: true }))).toBe("recommended");
  });
});

describe("les gestes que le serveur accepte", () => {
  const ALL: SetupAction[] = ["select", "initialize", "connect", "verify", "browse", "createLibraries", "readLibraries", "advice", "segments", "complete"];
  const allowed = (s: SetupFlowState) => ALL.filter((action) => setupActionAllowed(action, s));

  it("base à relier : rien", () => {
    expect(allowed(state({ databasePending: true }))).toEqual([]);
    expect(allowed(state({ databasePending: true, selection: selection("fresh"), linked: true }))).toEqual([]);
  });

  it("aucun Jellyfin choisi : seulement le choisir — ni compte, ni connexion, ni bibliothèque, ni fin", () => {
    expect(allowed(state())).toEqual(["select"]);
  });

  it.each([true, false])("Jellyfin NEUF (pile = %s) : créer le compte, puis les bibliothèques — jamais la connexion ni les réglages", (inStack) => {
    expect(allowed(state({ selection: selection("fresh", inStack) }))).toEqual(["select", "initialize"]);
    expect(allowed(state({ selection: selection("fresh", inStack), linked: true }))).toEqual([
      "select", "verify", "browse", "createLibraries", "readLibraries", "segments", "complete",
    ]);
  });

  it.each([true, false])("Jellyfin DÉJÀ configuré (pile = %s) : jamais créer un compte ni une bibliothèque, même relié", (inStack) => {
    expect(allowed(state({ selection: selection("configured", inStack) }))).toEqual(["select", "connect"]);
    const linked = allowed(state({ selection: selection("configured", inStack), linked: true }));
    expect(linked).toEqual(["select", "connect", "verify", "readLibraries", "advice", "segments", "complete"]);
    for (const refused of ["initialize", "browse", "createLibraries"] as const) expect(linked).not.toContain(refused);
  });

  it("changer de Jellyfin reste possible à toute étape d'avant la fin", () => {
    for (const s of [state(), state({ selection: selection("fresh"), linked: true }), state({ selection: selection("configured"), linked: true })]) {
      expect(setupActionAllowed("select", s)).toBe(true);
    }
  });
});
