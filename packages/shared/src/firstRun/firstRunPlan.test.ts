import { describe, expect, it } from "vitest";
import { firstRunKey, firstRunPlan, parseFirstRunSeen, withFirstRunSeen, type FirstRunInput } from "./firstRunPlan";

const SERVER = "https://tv.exemple.fr";
const base: FirstRunInput = { subjectId: "damien", serverUrl: SERVER, online: true, seen: [], pinDue: true, homeReady: true, photoDue: true };

describe("le premier lancement du mobile", () => {
  it("l'ordre de la TV : code PIN, accueil, photo", () => {
    expect(firstRunPlan(base)).toEqual({ kind: "show", steps: ["pinSetup", "homeRows", "photoSetup"] });
  });
  it("seulement les étapes dues", () => {
    expect(firstRunPlan({ ...base, pinDue: false, photoDue: false })).toEqual({ kind: "show", steps: ["homeRows"] });
    expect(firstRunPlan({ ...base, pinDue: false, homeReady: false, photoDue: false })).toEqual({ kind: "none" });
  });
  it("attend ce qui manque, jamais hors ligne", () => {
    expect(firstRunPlan({ ...base, pinDue: null })).toEqual({ kind: "pending" });
    expect(firstRunPlan({ ...base, photoDue: null })).toEqual({ kind: "pending" });
    expect(firstRunPlan({ ...base, online: false })).toEqual({ kind: "none" });
    expect(firstRunPlan({ ...base, subjectId: null })).toEqual({ kind: "none" });
  });
  it("une fois par profil et par appareil — un autre profil a le sien", () => {
    const seen = withFirstRunSeen([], firstRunKey(SERVER, "damien"));
    expect(firstRunPlan({ ...base, seen })).toEqual({ kind: "none" });
    expect(firstRunPlan({ ...base, seen, subjectId: "lea" }).kind).toBe("show");
    expect(withFirstRunSeen(seen, firstRunKey(SERVER, "damien"))).toHaveLength(1);
  });
  it("une liste illisible vaut « rien vu »", () => {
    expect(parseFirstRunSeen("pas du json")).toEqual([]);
    expect(parseFirstRunSeen(JSON.stringify(["a", 3]))).toEqual(["a"]);
  });
});
