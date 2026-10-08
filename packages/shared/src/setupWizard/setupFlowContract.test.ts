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
const state = (over: Partial<SetupFlowState> = {}): SetupFlowState => ({ databasePending: false, selection: null, linked: false, noLibraries: false, ...over });

/** Les installations : depuis le réseau local, ou avec le code. La base n'a plus d'écran (SQLite, 1.25) : rien à relier. */
const SHAPES: Array<[string, Omit<SetupFlowShape, "path">]> = [
  ["réseau local", { needsCode: false }],
  ["code", { needsCode: true }],
];

describe("les écrans de chaque parcours", () => {
  it("Jellyfin NEUF : compte créé, puis bibliothèques — jamais la connexion ni les réglages conseillés", () => {
    expect(setupFlowSteps({ needsCode: false, path: "fresh" })).toEqual([
      "welcome", "jellyfin", "account", "libraries", "recap", "apply", "remote", "done",
    ]);
  });

  it("Jellyfin DÉJÀ configuré : connexion, puis réglages conseillés — jamais de compte créé ni de bibliothèques", () => {
    expect(setupFlowSteps({ needsCode: false, path: "configured" })).toEqual([
      "welcome", "jellyfin", "signIn", "recommended", "recap", "apply", "remote", "done",
    ]);
  });

  it.each(SHAPES)("%s : l'étape « Jellyfin » est toujours là, juste avant le parcours, et jamais sautée", (_name, shape) => {
    for (const path of [null, "fresh", "configured"] as const) {
      const steps = setupFlowSteps({ ...shape, path });
      expect(steps).toContain("jellyfin");
      expect(steps.filter((s) => s === "jellyfin")).toHaveLength(1);
      expect(steps.includes("code")).toBe(shape.needsCode);
      expect(steps).not.toContain("database");
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
    const fresh = setupFlowSteps({ needsCode: true, path: "fresh" });
    const configured = setupFlowSteps({ needsCode: true, path: "configured" });
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

  it.each(SHAPES)("%s : depuis le récapitulatif, chaque écran d'avant du parcours jusqu'à la session ouverte, et rien d'autre", (_name, shape) => {
    for (const path of ["fresh", "configured"] as const) {
      const steps = setupFlowSteps({ ...shape, path });
      const back = walkBack(steps, "recap");
      expect(back).toEqual(steps.slice(steps.indexOf("jellyfin"), steps.indexOf("recap") + 1).reverse());
      expect(back).not.toContain("welcome");
      expect(back).not.toContain("code");
      const other = path === "fresh" ? ["signIn", "recommended"] : ["account", "libraries"];
      for (const step of other) expect(back).not.toContain(step);
    }
  });

  it("du code à l'accueil, oui ; une fois la session ouverte, plus de retour vers elles", () => {
    const steps = setupFlowSteps({ needsCode: true, path: null });
    expect(previousStep(steps, "code")).toBe("welcome");
    expect(previousStep(steps, "jellyfin")).toBeNull();
  });

  it("aucun retour depuis l'accueil, l'installation, l'accès à distance ni la fin", () => {
    const steps = setupFlowSteps({ needsCode: true, path: "fresh" });
    for (const step of ["welcome", "apply", "remote", "done"] as const) expect(previousStep(steps, step)).toBeNull();
  });

  it("un écran d'un autre parcours n'a ni avant ni après", () => {
    const steps = setupFlowSteps({ needsCode: false, path: "configured" });
    expect(previousStep(steps, "libraries")).toBeNull();
    expect(nextStep(steps, "account")).toBeNull();
  });

  it("l'écran d'après suit l'ordre, et s'arrête à la fin", () => {
    const steps = setupFlowSteps({ needsCode: false, path: "fresh" });
    expect(nextStep(steps, "jellyfin")).toBe("account");
    expect(nextStep(steps, "libraries")).toBe("recap");
    expect(nextStep(steps, "done")).toBeNull();
  });
});

describe("l'étape du serveur (où reprendre)", () => {
  it("base fermée : l'accueil, rien d'autre ; sinon TOUJOURS le choix du Jellyfin", () => {
    expect(setupStage(state({ databasePending: true, selection: selection("configured"), linked: true }))).toBe("welcome");
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
  const ALL: SetupAction[] = ["select", "initialize", "connect", "verify", "browse", "createLibraries", "readLibraries", "advice", "segments", "tmdb", "complete"];
  const allowed = (s: SetupFlowState) => ALL.filter((action) => setupActionAllowed(action, s));

  it("base fermée : rien", () => {
    expect(allowed(state({ databasePending: true }))).toEqual([]);
    expect(allowed(state({ databasePending: true, selection: selection("fresh"), linked: true }))).toEqual([]);
  });

  it("aucun Jellyfin choisi : seulement le choisir — ni compte, ni connexion, ni bibliothèque, ni fin", () => {
    expect(allowed(state())).toEqual(["select"]);
  });

  it.each([true, false])("Jellyfin NEUF (pile = %s) : créer le compte, puis les bibliothèques — jamais la connexion ni les réglages", (inStack) => {
    expect(allowed(state({ selection: selection("fresh", inStack) }))).toEqual(["select", "initialize"]);
    expect(allowed(state({ selection: selection("fresh", inStack), linked: true }))).toEqual([
      "select", "verify", "browse", "createLibraries", "readLibraries", "segments", "tmdb", "complete",
    ]);
  });

  it.each([true, false])("Jellyfin DÉJÀ configuré (pile = %s) : jamais créer un compte ni une bibliothèque, même relié", (inStack) => {
    expect(allowed(state({ selection: selection("configured", inStack) }))).toEqual(["select", "connect"]);
    const linked = allowed(state({ selection: selection("configured", inStack), linked: true }));
    expect(linked).toEqual(["select", "connect", "verify", "readLibraries", "advice", "segments", "tmdb", "complete"]);
    for (const refused of ["initialize", "browse", "createLibraries"] as const) expect(linked).not.toContain(refused);
  });

  it("changer de Jellyfin reste possible à toute étape d'avant la fin", () => {
    for (const s of [state(), state({ selection: selection("fresh"), linked: true }), state({ selection: selection("configured"), linked: true })]) {
      expect(setupActionAllowed("select", s)).toBe(true);
    }
  });
});

describe("Jellyfin déjà configuré mais SANS bibliothèque (constaté à la connexion)", () => {
  const empty = (over: Partial<SetupFlowState> = {}) => state({ selection: { ...selection("configured"), noLibraries: true }, linked: true, noLibraries: true, ...over });

  it("ses bibliothèques sont proposées entre la connexion et les réglages conseillés", () => {
    expect(setupFlowSteps({ needsCode: false, path: "configured", noLibraries: true })).toEqual([
      "welcome", "jellyfin", "signIn", "libraries", "recommended", "recap", "apply", "remote", "done",
    ]);
    // Un écran de plus, dit dès qu'on le sait ; jamais de compte créé.
    expect(setupFlowLength({ needsCode: false, path: "configured", noLibraries: true })).toBe(9);
    expect(setupFlowSteps({ needsCode: true, path: "configured", noLibraries: true })).not.toContain("account");
  });

  it("le neuf n'en dépend pas : `noLibraries` ne change que le parcours configuré", () => {
    expect(setupFlowSteps({ needsCode: false, path: "fresh", noLibraries: true })).toEqual(
      setupFlowSteps({ needsCode: false, path: "fresh" }),
    );
  });

  it("on y reprend aux bibliothèques ; le retour remonte bibliothèques → connexion → Jellyfin", () => {
    expect(setupStage(empty())).toBe("libraries");
    const steps = setupFlowSteps({ needsCode: false, path: "configured", noLibraries: true });
    expect(previousStep(steps, "recommended")).toBe("libraries");
    expect(previousStep(steps, "libraries")).toBe("signIn");
    expect(nextStep(steps, "libraries")).toBe("recommended");
  });

  it("parcourir et créer des bibliothèques y sont permis — et SEULEMENT dans ce cas, pour un Jellyfin configuré", () => {
    for (const action of ["browse", "createLibraries"] as const) {
      expect(setupActionAllowed(action, empty())).toBe(true);
      // Avec des bibliothèques, pas relié, ou un serveur qui ne le dit pas : refusé (409).
      expect(setupActionAllowed(action, empty({ noLibraries: false }))).toBe(false);
      expect(setupActionAllowed(action, empty({ noLibraries: undefined }))).toBe(false);
      expect(setupActionAllowed(action, empty({ linked: false }))).toBe(false);
    }
    expect(setupActionAllowed("initialize", empty())).toBe(false);
  });
});

describe("la clé TMDB (écran facultatif, dans les deux parcours)", () => {
  const withTmdb = { needsCode: false, asksTmdb: true } as const;

  it("juste avant le récapitulatif, après les bibliothèques (neuf) ou les réglages conseillés (configuré)", () => {
    expect(setupFlowSteps({ ...withTmdb, path: "fresh" })).toEqual([
      "welcome", "jellyfin", "account", "libraries", "tmdb", "recap", "apply", "remote", "done",
    ]);
    expect(setupFlowSteps({ ...withTmdb, path: "configured" })).toEqual([
      "welcome", "jellyfin", "signIn", "recommended", "tmdb", "recap", "apply", "remote", "done",
    ]);
    expect(setupFlowSteps({ ...withTmdb, path: "configured", noLibraries: true })).toEqual([
      "welcome", "jellyfin", "signIn", "libraries", "recommended", "tmdb", "recap", "apply", "remote", "done",
    ]);
  });

  it("un écran de plus, annoncé avant même le choix du Jellyfin", () => {
    const total = setupFlowLength({ ...withTmdb, path: null });
    expect(total).toBe(setupFlowLength({ needsCode: false, path: null }) + 1);
    for (const path of ["fresh", "configured"] as const) expect(setupFlowSteps({ ...withTmdb, path })).toHaveLength(total);
  });

  it("on avance au récapitulatif (clé ou « plus tard ») et on revient à l'écran d'avant", () => {
    const steps = setupFlowSteps({ ...withTmdb, path: "fresh" });
    expect(nextStep(steps, "libraries")).toBe("tmdb");
    expect(nextStep(steps, "tmdb")).toBe("recap");
    expect(previousStep(steps, "recap")).toBe("tmdb");
    expect(previousStep(steps, "tmdb")).toBe("libraries");
  });

  it("un serveur d'avant l'écran (rien de déclaré) : pas d'écran TMDB", () => {
    for (const path of ["fresh", "configured"] as const) expect(setupFlowSteps({ needsCode: false, path })).not.toContain("tmdb");
  });

  it("le geste n'est permis qu'une fois relié — jamais avant le compte", () => {
    expect(setupActionAllowed("tmdb", state())).toBe(false);
    expect(setupActionAllowed("tmdb", state({ selection: selection("fresh") }))).toBe(false);
    expect(setupActionAllowed("tmdb", state({ selection: selection("configured"), linked: true }))).toBe(true);
    expect(setupActionAllowed("tmdb", state({ databasePending: true, selection: selection("fresh"), linked: true }))).toBe(false);
  });
});
