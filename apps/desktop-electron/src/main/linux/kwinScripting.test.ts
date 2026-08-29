import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * Le pont gdbus, sans gdbus : chaque réponse est jouée d'avance. Ce qui se
 * garde ici : le parsing des retours D-Bus (dont le refus `-1` de KWin), la
 * mémorisation de la disponibilité, et l'échec qui ne jette jamais.
 */

const { fake } = vi.hoisted(() => ({
  fake: {
    responses: [] as { error: Error | null; output: string }[],
    commands: [] as string[][],
  },
}));

vi.mock("node:child_process", () => ({
  execFileSync: (_cmd: string, args: string[]) => {
    fake.commands.push(args);
    const r = fake.responses.shift() ?? { error: new Error("aucune réponse prévue"), output: "" };
    if (r.error !== null) throw r.error;
    return r.output;
  },
  execFile: (
    _cmd: string,
    args: string[],
    _opts: unknown,
    callback: (e: Error | null, output: string) => void,
  ) => {
    fake.commands.push(args);
    const r = fake.responses.shift() ?? { error: new Error("aucune réponse prévue"), output: "" };
    callback(r.error, r.output);
  },
}));

import {
  kwinScriptApiAvailable,
  loadDeclarativeScript,
  unloadScript,
  unloadScriptSync,
  runScript,
  forgetKwinAvailability,
} from "./kwinScripting";

beforeEach(() => {
  fake.responses.length = 0;
  fake.commands.length = 0;
});

afterEach(() => {
  forgetKwinAvailability();
});

describe("apiScriptKwinDisponible", () => {
  it("vraie quand l'introspection cite loadDeclarativeScript, et MÉMORISÉE", async () => {
    fake.responses.push({ error: null, output: "… loadDeclarativeScript(s chemin) …" });
    expect(await kwinScriptApiAvailable()).toBe(true);
    // Second appel : aucune réponse préparée — s'il repartait sur le bus, il
    // recevrait l'erreur « aucune réponse prévue » et rendrait faux.
    expect(await kwinScriptApiAvailable()).toBe(true);
    expect(fake.commands).toHaveLength(1);
  });

  it("fausse quand gdbus échoue (pas de KWin sur le bus)", async () => {
    fake.responses.push({ error: new Error("Error: GDBus.Error…"), output: "" });
    expect(await kwinScriptApiAvailable()).toBe(false);
  });

  it("fausse quand l'objet répond mais sans moteur déclaratif", async () => {
    fake.responses.push({ error: null, output: "… loadScript(s chemin) …" });
    expect(await kwinScriptApiAvailable()).toBe(false);
  });
});

describe("chargerScriptDeclaratif", () => {
  it("rend le numéro du script chargé", async () => {
    fake.responses.push({ error: null, output: "(0,)\n" });
    expect(await loadDeclarativeScript("/tmp/colle.qml")).toBe(0);
    fake.responses.push({ error: null, output: "(int32 7,)\n" });
    expect(await loadDeclarativeScript("/tmp/colle.qml")).toBe(7);
  });

  it("le refus de KWin (numéro négatif) rend null", async () => {
    fake.responses.push({ error: null, output: "(-1,)\n" });
    expect(await loadDeclarativeScript("/tmp/absent.qml")).toBeNull();
  });

  it("l'échec de gdbus rend null, sans jeter", async () => {
    fake.responses.push({ error: new Error("timeout"), output: "" });
    expect(await loadDeclarativeScript("/tmp/colle.qml")).toBeNull();
  });

  it("passe le nom de greffon quand il y en a un — la prise du déchargement", async () => {
    fake.responses.push({ error: null, output: "(0,)\n" });
    await loadDeclarativeScript("/tmp/colle.qml", "tentacle-colle-42");
    expect(fake.commands[0]?.slice(-2)).toEqual(["/tmp/colle.qml", "tentacle-colle-42"]);
    // Sans nom, KWin reçoit le seul chemin : la forme à un argument existe.
    fake.responses.push({ error: null, output: "(1,)\n" });
    await loadDeclarativeScript("/tmp/colle.qml");
    expect(fake.commands[1]?.at(-1)).toBe("/tmp/colle.qml");
  });
});

describe("lancerScript", () => {
  it("vise /Scripting/Script<id> et rend le succès", async () => {
    fake.responses.push({ error: null, output: "()\n" });
    expect(await runScript(4)).toBe(true);
    expect(fake.commands[0]).toContain("/Scripting/Script4");
    fake.responses.push({ error: new Error("mort"), output: "" });
    expect(await runScript(4)).toBe(false);
  });
});

describe("dechargerScript", () => {
  it("rend vrai quand KWin avait bien ce greffon, faux sinon", async () => {
    fake.responses.push({ error: null, output: "(true,)\n" });
    expect(await unloadScript("tentacle-colle-42")).toBe(true);
    // « (false,) » n'est pas une erreur : c'est la réponse à « reste-t-il
    // quelque chose ? », posée avant chaque pose.
    fake.responses.push({ error: null, output: "(false,)\n" });
    expect(await unloadScript("tentacle-colle-42")).toBe(false);
    fake.responses.push({ error: new Error("pas de bus"), output: "" });
    expect(await unloadScript("tentacle-colle-42")).toBe(false);
  });

  it("la variante synchrone ne jette jamais — le départ ne doit pas échouer", () => {
    fake.responses.push({ error: new Error("délai dépassé"), output: "" });
    expect(() => { unloadScriptSync("tentacle-colle-42"); }).not.toThrow();
    expect(fake.commands[0]).toContain("org.kde.kwin.Scripting.unloadScript");
  });
});
