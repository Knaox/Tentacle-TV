/**
 * Les valeurs d'un formulaire `setup` : validées champ par champ, un secret
 * vide garde celui qui est enregistré, et le verdict d'une route de test se lit
 * sans rien supposer du plugin. Le verrou du miroir du contrat est ici aussi.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { readPluginSetupMeta, type PluginSetupMeta } from "./pluginSetup";
import { applySetupValues, describeSetup, readTestVerdict, resolveSetupValues } from "./setupValues";

const text = (fr: string) => ({ fr, en: fr });
const META = readPluginSetupMeta({
  fields: [
    { key: "url", kind: "url", required: true, label: text("Adresse") },
    { key: "apiKey", kind: "secret", required: true, label: text("Clé") },
    { key: "note", kind: "text", required: false, label: text("Note") },
  ],
  test: "/admin/test-connection",
}) as PluginSetupMeta;

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) folder = dirname(folder);
  return folder;
}

describe("miroir du contrat setup", () => {
  it("pluginSetup.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/routes/pluginSetup/pluginSetup.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/plugins/pluginSetup.ts"), "utf8"));
  });
});

describe("valeurs du formulaire", () => {
  it("valide, rogne, et retire la barre finale d'une adresse", () => {
    expect(resolveSetupValues(META, { url: " http://seerr:5055/ ", apiKey: " k1 ", other: "ignoré" }, {})).toEqual({
      ok: true,
      values: { url: "http://seerr:5055", apiKey: "k1" },
    });
  });

  it("un secret laissé vide garde celui qui est enregistré", () => {
    expect(resolveSetupValues(META, { url: "http://seerr:5055", apiKey: "" }, { apiKey: "ancienne" })).toEqual({
      ok: true,
      values: { url: "http://seerr:5055", apiKey: "ancienne" },
    });
  });

  it("un champ requis manquant, ou une adresse qui n'en est pas une, est nommé", () => {
    expect(resolveSetupValues(META, { url: "http://seerr:5055" }, {})).toEqual({ ok: false, field: "apiKey", reason: "missing" });
    expect(resolveSetupValues(META, { url: "seerr:5055", apiKey: "k" }, {})).toEqual({ ok: false, field: "url", reason: "invalid" });
    expect(resolveSetupValues(META, { url: 42, apiKey: "k" }, {})).toEqual({ ok: false, field: "url", reason: "missing" });
  });

  it("ce que voit le formulaire : jamais un secret, seulement s'il est posé", () => {
    const config = { url: "http://seerr:5055", apiKey: "secret", enabled: true, userLimit: 3 };
    expect(describeSetup(META, config)).toEqual({
      values: { url: "http://seerr:5055", note: "" },
      secrets: { apiKey: true },
      configured: true,
      enabled: true,
    });
    expect(describeSetup(META, {})).toMatchObject({ configured: false, enabled: false, secrets: { apiKey: false } });
  });

  it("enregistrer garde le reste de la configuration et active l'intégration", () => {
    expect(applySetupValues({ userLimit: 3, enabled: false, url: "http://old" }, { url: "http://new", apiKey: "k" })).toEqual({
      userLimit: 3,
      enabled: true,
      url: "http://new",
      apiKey: "k",
    });
  });
});

describe("verdict de la route de test", () => {
  it("lit ok, le code d'échec et la version", () => {
    expect(readTestVerdict(200, { ok: true, version: "2.7.3", arr: {} })).toEqual({ ok: true, error: null, version: "2.7.3" });
    expect(readTestVerdict(200, { ok: false, error: "invalid-key", version: "2.7.3" })).toEqual({ ok: false, error: "invalid-key", version: "2.7.3" });
  });

  it("route absente : le module serveur du plugin ne tourne pas encore", () => {
    expect(readTestVerdict(404, { message: "Route not found" })).toEqual({ ok: false, error: "plugin-not-running", version: null });
  });

  it("tout le reste est un test raté, sans relayer un code douteux", () => {
    expect(readTestVerdict(500, { ok: true })).toMatchObject({ ok: false, error: "test-failed" });
    expect(readTestVerdict(200, "<html>")).toMatchObject({ ok: false, error: "test-failed" });
    expect(readTestVerdict(200, { ok: false, error: "<script>" })).toMatchObject({ ok: false, error: "test-failed" });
  });
});
