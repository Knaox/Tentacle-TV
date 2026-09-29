import { describe, expect, it } from "vitest";
import { compareJellyfinVersions, parseCompatManifest, parseJellyfinVersion } from "./compatManifest";

const feature = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  area: id.split(".")[0],
  label: { fr: `FR ${id}`, en: `EN ${id}` },
  ...extra,
});

const valid = () => ({
  schema: 1,
  revision: 3,
  generatedAt: "2026-09-29T12:00:00Z",
  minimum: "10.10.0",
  lines: [{ id: "12", from: "12.0.0", until: "13.0.0" }],
  areas: { auth: { fr: "Connexion", en: "Sign-in" } },
  features: [
    feature("auth.header", { critical: true, endpoints: ["POST /Users/AuthenticateByName"] }),
    feature("items.collections", { since: "12.0.0", endpoints: ["GET /Items/{itemId}/Collections"] }),
  ],
  versions: [
    {
      version: "12.1.0",
      image: "jellyfin/jellyfin:12.1",
      ranAt: "2026-09-29T11:00:00Z",
      tentacle: { server: "1.21.0", commit: "abc1234" },
      verdict: "partial",
      features: {
        "auth.header": "ok",
        "items.collections": { verdict: "partial", checks: 4, failed: 1, note: { fr: "manque", en: "missing" } },
      },
    },
  ],
});

describe("versions de Jellyfin", () => {
  it("lit les deux numérotations, préfixe v compris", () => {
    expect(parseJellyfinVersion("10.11.8")).toEqual([10, 11, 8]);
    expect(parseJellyfinVersion("v12.1")).toEqual([12, 1]);
    expect(parseJellyfinVersion("12.1.0.0")).toEqual([12, 1, 0, 0]);
  });

  it("refuse les pré-versions et le reste", () => {
    for (const raw of ["12.0-rc7", "", "latest", "12..1", "1.2.3.4.5"]) expect(parseJellyfinVersion(raw)).toBeNull();
  });

  it("« 12.1 » vaut « 12.1.0 », et 10.11.11 précède 12.0", () => {
    expect(compareJellyfinVersions("12.1", "12.1.0")).toBe(0);
    expect(compareJellyfinVersions("10.11.11", "12.0")).toBeLessThan(0);
    expect(compareJellyfinVersions("10.11.10", "10.11.9")).toBeGreaterThan(0);
  });
});

describe("lecture du manifeste", () => {
  it("lit un manifeste complet, verdict court ou détaillé", () => {
    const parsed = parseCompatManifest(valid());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [entry] = parsed.manifest.versions;
    expect(entry.features["auth.header"]).toEqual({ verdict: "ok", checks: null, failed: null, note: null });
    expect(entry.features["items.collections"]).toMatchObject({ verdict: "partial", checks: 4, failed: 1 });
    expect(parsed.manifest.features[0]).toMatchObject({ critical: true, since: null });
    expect(parsed.manifest.features[1]).toMatchObject({ critical: false, since: "12.0.0" });
  });

  it("une note en texte seul vaut pour les deux langues", () => {
    const raw = valid();
    raw.versions[0].features["items.collections"] = { verdict: "fail", note: "à revoir" } as never;
    const parsed = parseCompatManifest(raw);
    expect(parsed.ok && parsed.manifest.versions[0].features["items.collections"].note).toEqual({ fr: "à revoir", en: "à revoir" });
  });

  it("refuse un autre schéma, sans chercher plus loin", () => {
    expect(parseCompatManifest({ ...valid(), schema: 2 })).toEqual({ ok: false, errors: [expect.stringContaining("schéma 2")] });
    expect(parseCompatManifest(null).ok).toBe(false);
  });

  it("refuse TOUT le manifeste pour une seule entrée fautive, et dit toutes les fautes", () => {
    const raw = valid() as Record<string, unknown>;
    (raw.versions as Array<Record<string, unknown>>)[0].verdict = "maybe";
    (raw.features as Array<Record<string, unknown>>)[1].endpoints = ["/sans/methode"];
    const parsed = parseCompatManifest(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toHaveLength(2);
  });

  it("refuse un verdict de fonctionnalité inconnu, et un identifiant hors catalogue", () => {
    const raw = valid();
    raw.versions[0].features["auth.header"] = "maybe";
    (raw.versions[0].features as Record<string, unknown>)["ghost.feature"] = "ok";
    const parsed = parseCompatManifest(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join("\n")).toMatch(/auth\.header[\s\S]*ghost\.feature/);
  });

  it("refuse les doublons de version (même numérique) et de fonctionnalité", () => {
    const raw = valid();
    raw.versions.push({ ...raw.versions[0], version: "12.1" });
    raw.features.push(feature("auth.header"));
    const parsed = parseCompatManifest(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toContain("version 12.1 en double");
    expect(parsed.errors).toContain("fonctionnalité auth.header en double");
  });

  it("refuse une révision négative ou fractionnaire, une lignée vide", () => {
    expect(parseCompatManifest({ ...valid(), revision: -1 }).ok).toBe(false);
    expect(parseCompatManifest({ ...valid(), revision: 1.5 }).ok).toBe(false);
    expect(parseCompatManifest({ ...valid(), lines: [{ id: "x", from: "12.0", until: "12.0" }] }).ok).toBe(false);
  });

  it("un libellé doit exister dans les deux langues", () => {
    const raw = valid();
    raw.features[0].label = { fr: "Connexion", en: "" };
    expect(parseCompatManifest(raw).ok).toBe(false);
  });

  it("accepte un manifeste amorcé, sans rien d'éprouvé", () => {
    const parsed = parseCompatManifest({ schema: 1, revision: 0, lines: [], features: [], versions: [] });
    expect(parsed.ok && parsed.manifest).toMatchObject({ revision: 0, minimum: null, generatedAt: null, areas: {} });
  });
});
