import { describe, expect, it } from "vitest";
import { isSetupUrl, readPluginSetupMeta } from "./pluginSetup";

const text = (fr: string, en = fr.toUpperCase()) => ({ fr, en });

const valid = () => ({
  title: text("Connexion"),
  description: text("L'adresse et la clé"),
  fields: [
    { key: "url", kind: "url", required: true, label: text("Adresse"), placeholder: " http://jellyseerr:5055 ", hint: text("Joignable par le serveur") },
    { key: "apiKey", kind: "secret", required: true, label: text("Clé d'API") },
  ],
  test: "/admin/test-connection",
  errors: { "invalid-key": text("Clé refusée"), "Bad Code!": text("ignoré") },
});

describe("contrat setup d'un plugin", () => {
  it("lit un contrat complet, en nettoyant ce qui dépasse", () => {
    const meta = readPluginSetupMeta(valid());
    expect(meta).toMatchObject({ title: { fr: "Connexion" }, test: "/admin/test-connection" });
    expect(meta?.fields[0]).toEqual({
      key: "url", kind: "url", required: true, label: { fr: "Adresse", en: "ADRESSE" }, placeholder: "http://jellyseerr:5055",
      hint: { fr: "Joignable par le serveur", en: "JOIGNABLE PAR LE SERVEUR" },
    });
    expect(meta?.fields[1]).toMatchObject({ key: "apiKey", kind: "secret", placeholder: null, hint: null });
    expect(Object.keys(meta?.errors ?? {})).toEqual(["invalid-key"]);
  });

  it("tout ou rien : un seul champ fautif fait tomber le formulaire", () => {
    const withBadKind = valid();
    withBadKind.fields[1] = { ...withBadKind.fields[1], kind: "password" };
    expect(readPluginSetupMeta(withBadKind)).toBeNull();
    const withoutLabel = valid();
    withoutLabel.fields[0] = { ...withoutLabel.fields[0], label: { fr: "Adresse", en: "" } };
    expect(readPluginSetupMeta(withoutLabel)).toBeNull();
  });

  it("« enabled » est à Tentacle : aucun champ ne peut le déclarer", () => {
    const raw = valid();
    raw.fields.push({ key: "enabled", kind: "text", required: false, label: text("Actif") });
    expect(readPluginSetupMeta(raw)).toBeNull();
  });

  it("refuse les clés en double, trop de champs, une route de test hors du plugin", () => {
    const twice = valid();
    twice.fields.push({ ...twice.fields[0] });
    expect(readPluginSetupMeta(twice)).toBeNull();
    const many = valid();
    many.fields = Array.from({ length: 7 }, (_, i) => ({ key: `f${String(i)}`, kind: "text", required: false, label: text("x") }));
    expect(readPluginSetupMeta(many)).toBeNull();
    for (const test of ["https://evil.test/x", "/../../admin", "admin/test", "//evil", "/a?b=1"]) {
      expect(readPluginSetupMeta({ ...valid(), test })).toBeNull();
    }
  });

  it("sans champ ou sans contrat : pas de formulaire", () => {
    expect(readPluginSetupMeta({ ...valid(), fields: [] })).toBeNull();
    expect(readPluginSetupMeta(undefined)).toBeNull();
  });

  it("une adresse est absolue et en http(s)", () => {
    expect(isSetupUrl("http://jellyseerr:5055")).toBe(true);
    expect(isSetupUrl("https://seerr.example.com/base")).toBe(true);
    for (const bad of ["jellyseerr:5055", "ftp://x", "javascript:alert(1)", ""]) expect(isSetupUrl(bad)).toBe(false);
  });
});
