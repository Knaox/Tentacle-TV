import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * Le pont gdbus, sans gdbus : chaque réponse est jouée d'avance. Ce qui se
 * garde ici : le parsing des retours D-Bus (dont le refus `-1` de KWin), la
 * mémorisation de la disponibilité, et l'échec qui ne jette jamais.
 */

const { faux } = vi.hoisted(() => ({
  faux: {
    reponses: [] as { erreur: Error | null; sortie: string }[],
    commandes: [] as string[][],
  },
}));

vi.mock("node:child_process", () => ({
  execFileSync: (_cmd: string, args: string[]) => {
    faux.commandes.push(args);
    const r = faux.reponses.shift() ?? { erreur: new Error("aucune réponse prévue"), sortie: "" };
    if (r.erreur !== null) throw r.erreur;
    return r.sortie;
  },
  execFile: (
    _cmd: string,
    args: string[],
    _opts: unknown,
    rappel: (e: Error | null, sortie: string) => void,
  ) => {
    faux.commandes.push(args);
    const r = faux.reponses.shift() ?? { erreur: new Error("aucune réponse prévue"), sortie: "" };
    rappel(r.erreur, r.sortie);
  },
}));

import {
  apiScriptKwinDisponible,
  chargerScriptDeclaratif,
  dechargerScript,
  dechargerScriptSync,
  lancerScript,
  oublierDisponibiliteKwin,
} from "./kwinScripting";

beforeEach(() => {
  faux.reponses.length = 0;
  faux.commandes.length = 0;
});

afterEach(() => {
  oublierDisponibiliteKwin();
});

describe("apiScriptKwinDisponible", () => {
  it("vraie quand l'introspection cite loadDeclarativeScript, et MÉMORISÉE", async () => {
    faux.reponses.push({ erreur: null, sortie: "… loadDeclarativeScript(s chemin) …" });
    expect(await apiScriptKwinDisponible()).toBe(true);
    // Second appel : aucune réponse préparée — s'il repartait sur le bus, il
    // recevrait l'erreur « aucune réponse prévue » et rendrait faux.
    expect(await apiScriptKwinDisponible()).toBe(true);
    expect(faux.commandes).toHaveLength(1);
  });

  it("fausse quand gdbus échoue (pas de KWin sur le bus)", async () => {
    faux.reponses.push({ erreur: new Error("Error: GDBus.Error…"), sortie: "" });
    expect(await apiScriptKwinDisponible()).toBe(false);
  });

  it("fausse quand l'objet répond mais sans moteur déclaratif", async () => {
    faux.reponses.push({ erreur: null, sortie: "… loadScript(s chemin) …" });
    expect(await apiScriptKwinDisponible()).toBe(false);
  });
});

describe("chargerScriptDeclaratif", () => {
  it("rend le numéro du script chargé", async () => {
    faux.reponses.push({ erreur: null, sortie: "(0,)\n" });
    expect(await chargerScriptDeclaratif("/tmp/colle.qml")).toBe(0);
    faux.reponses.push({ erreur: null, sortie: "(int32 7,)\n" });
    expect(await chargerScriptDeclaratif("/tmp/colle.qml")).toBe(7);
  });

  it("le refus de KWin (numéro négatif) rend null", async () => {
    faux.reponses.push({ erreur: null, sortie: "(-1,)\n" });
    expect(await chargerScriptDeclaratif("/tmp/absent.qml")).toBeNull();
  });

  it("l'échec de gdbus rend null, sans jeter", async () => {
    faux.reponses.push({ erreur: new Error("timeout"), sortie: "" });
    expect(await chargerScriptDeclaratif("/tmp/colle.qml")).toBeNull();
  });

  it("passe le nom de greffon quand il y en a un — la prise du déchargement", async () => {
    faux.reponses.push({ erreur: null, sortie: "(0,)\n" });
    await chargerScriptDeclaratif("/tmp/colle.qml", "tentacle-colle-42");
    expect(faux.commandes[0]?.slice(-2)).toEqual(["/tmp/colle.qml", "tentacle-colle-42"]);
    // Sans nom, KWin reçoit le seul chemin : la forme à un argument existe.
    faux.reponses.push({ erreur: null, sortie: "(1,)\n" });
    await chargerScriptDeclaratif("/tmp/colle.qml");
    expect(faux.commandes[1]?.at(-1)).toBe("/tmp/colle.qml");
  });
});

describe("lancerScript", () => {
  it("vise /Scripting/Script<id> et rend le succès", async () => {
    faux.reponses.push({ erreur: null, sortie: "()\n" });
    expect(await lancerScript(4)).toBe(true);
    expect(faux.commandes[0]).toContain("/Scripting/Script4");
    faux.reponses.push({ erreur: new Error("mort"), sortie: "" });
    expect(await lancerScript(4)).toBe(false);
  });
});

describe("dechargerScript", () => {
  it("rend vrai quand KWin avait bien ce greffon, faux sinon", async () => {
    faux.reponses.push({ erreur: null, sortie: "(true,)\n" });
    expect(await dechargerScript("tentacle-colle-42")).toBe(true);
    // « (false,) » n'est pas une erreur : c'est la réponse à « reste-t-il
    // quelque chose ? », posée avant chaque pose.
    faux.reponses.push({ erreur: null, sortie: "(false,)\n" });
    expect(await dechargerScript("tentacle-colle-42")).toBe(false);
    faux.reponses.push({ erreur: new Error("pas de bus"), sortie: "" });
    expect(await dechargerScript("tentacle-colle-42")).toBe(false);
  });

  it("la variante synchrone ne jette jamais — le départ ne doit pas échouer", () => {
    faux.reponses.push({ erreur: new Error("délai dépassé"), sortie: "" });
    expect(() => { dechargerScriptSync("tentacle-colle-42"); }).not.toThrow();
    expect(faux.commandes[0]).toContain("org.kde.kwin.Scripting.unloadScript");
  });
});
