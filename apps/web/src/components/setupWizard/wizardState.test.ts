import { describe, expect, it } from "vitest";
import type { SetupContext, SetupFlowState } from "@tentacle-tv/shared";
import { initialData, wizardReducer, type WizardAction, type WizardState } from "./wizardState";

/**
 * Les transitions de l'assistant côté client : on ne va, on n'avance et on ne
 * revient que DANS le parcours que le serveur a fixé ; changer de Jellyfin
 * repart du premier écran du nouveau parcours et oublie ce qui valait pour
 * l'ancien. Pile complète (base fournie) et sans pile (base à relier).
 */
const SALON = { url: "http://192.168.1.20:8096", serverId: "salon", serverName: "Salon", version: "10.11.11", inStack: false, path: "configured" as const };
const PILE = { url: "http://jellyfin:8096", serverId: "pile", serverName: "Tentacle", version: "12.1.0", inStack: true, path: "fresh" as const };

function context(flow: Partial<SetupFlowState>, fromEnv = true): SetupContext {
  return {
    deployment: "docker",
    stack: fromEnv ? "full" : "only",
    provisioner: fromEnv ? "docker-sibling" : "existing-instance",
    database: { configured: true, connected: true, fromEnv },
    jellyfin: { url: null, suggestedUrl: null, configured: false, claimed: false, joined: false, clientUrl: "http://192.168.1.20:47896" },
    flow: { databasePending: false, selection: null, linked: false, ...flow },
    mediaHostPath: null,
    mediaFolders: null,
    os: null,
    missingJellyfin: { kind: "compose", stack: "tentacle-full", docsUrl: "https://tentacletv.app/install/" },
    secure: false,
  };
}

const start = (): WizardState => ({ step: "welcome", data: { ...initialData({ language: "fr", country: "FR" }), needsCode: false } });
const run = (state: WizardState, ...actions: WizardAction[]) => actions.reduce(wizardReducer, state);
/** Revenir en arrière autant que possible : la liste des écrans traversés. */
function walkBack(state: WizardState): string[] {
  const seen = [state.step];
  for (let current = state, next = wizardReducer(state, { type: "back" }); next.step !== current.step; current = next, next = wizardReducer(next, { type: "back" })) {
    seen.push(next.step);
  }
  return seen;
}

describe.each([
  ["pile complète", true],
  ["sans pile (base à relier)", false],
])("%s", (_name, fromEnv) => {
  const first = fromEnv ? "jellyfin" : "database";

  it("la session ouverte, aucun Jellyfin choisi : l'écran « Jellyfin », et rien au-delà ne s'atteint", () => {
    const entered = run(start(), { type: "enter", context: context({}, fromEnv), step: first });
    expect(entered.step).toBe(first);
    const atJellyfin = run(entered, { type: "go", step: "jellyfin" });
    expect(atJellyfin.step).toBe("jellyfin");
    for (const target of ["account", "libraries", "signIn", "recommended", "recap"] as const) {
      expect(run(atJellyfin, { type: "go", step: target }).step).toBe("jellyfin");
    }
    expect(run(atJellyfin, { type: "next" }).step).toBe("jellyfin");
  });

  it("Jellyfin NEUF choisi : compte, bibliothèques, récapitulatif — et le retour ne remonte que par eux", () => {
    let state = run(start(), { type: "enter", context: context({}, fromEnv), step: "jellyfin" }, { type: "choose", context: context({ selection: PILE }, fromEnv) });
    expect(state.step).toBe("account");
    state = run(state, { type: "patch", data: { context: context({ selection: PILE, linked: true }, fromEnv) } }, { type: "next" }, { type: "next" });
    expect(state.step).toBe("recap");
    expect(walkBack(state)).toEqual(["recap", "libraries", "account", "jellyfin", ...(fromEnv ? [] : ["database"])]);
    expect(run(state, { type: "go", step: "signIn" }).step).toBe("recap");
    expect(run(state, { type: "go", step: "recommended" }).step).toBe("recap");
  });

  it("Jellyfin DÉJÀ configuré choisi : connexion, réglages conseillés — jamais le compte ni les bibliothèques", () => {
    let state = run(start(), { type: "enter", context: context({}, fromEnv), step: "jellyfin" }, { type: "choose", context: context({ selection: SALON }, fromEnv) });
    expect(state.step).toBe("signIn");
    state = run(state, { type: "patch", data: { context: context({ selection: SALON, linked: true }, fromEnv) } }, { type: "next" }, { type: "next" });
    expect(state.step).toBe("recap");
    expect(walkBack(state)).toEqual(["recap", "recommended", "signIn", "jellyfin", ...(fromEnv ? [] : ["database"])]);
    for (const target of ["account", "libraries"] as const) expect(run(state, { type: "go", step: target }).step).toBe("recap");
  });

  it("changer de Jellyfin en revenant au choix : le parcours est recalculé, ce qui valait pour l'autre est oublié", () => {
    let state = run(start(), { type: "enter", context: context({}, fromEnv), step: "jellyfin" }, { type: "choose", context: context({ selection: PILE }, fromEnv) });
    state = run(
      state,
      { type: "patch", data: { context: context({ selection: PILE, linked: true }, fromEnv), credentials: { username: "Knaoxtest", password: "x" }, plans: [{ name: "Films", type: "movies", paths: ["/media/films"] }] } },
      { type: "next" },
      { type: "back" },
      { type: "back" },
    );
    expect(state.step).toBe("jellyfin");
    state = run(state, { type: "choose", context: context({ selection: SALON }, fromEnv) });
    expect(state.step).toBe("signIn");
    expect(state.data.credentials).toBeNull();
    expect(state.data.plans).toEqual([]);
    expect(run(state, { type: "go", step: "libraries" }).step).toBe("signIn");
  });

  it("le même Jellyfin rechoisi : rien n'est oublié", () => {
    let state = run(start(), { type: "enter", context: context({}, fromEnv), step: "jellyfin" }, { type: "choose", context: context({ selection: SALON }, fromEnv) });
    state = run(state, { type: "patch", data: { credentials: { username: "Knaoxtest", password: "x" } } }, { type: "back" });
    state = run(state, { type: "choose", context: context({ selection: SALON, linked: true }, fromEnv) });
    expect(state.step).toBe("signIn");
    expect(state.data.credentials).toEqual({ username: "Knaoxtest", password: "x" });
  });
});
