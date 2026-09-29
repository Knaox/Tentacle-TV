import { describe, expect, it } from "vitest";
import { parseCompatManifest, type CompatManifest } from "./compatManifest";
import { deriveTestedVerdict, resolveCompat } from "./compatVerdict";

const label = (id: string) => ({ fr: `FR ${id}`, en: `EN ${id}` });

function manifest(): CompatManifest {
  const parsed = parseCompatManifest({
    schema: 1,
    revision: 1,
    minimum: "10.10.0",
    lines: [
      { id: "10.11", from: "10.11.0", until: "10.12.0" },
      { id: "12", from: "12.0.0", until: "13.0.0" },
      { id: "10.10", from: "10.10.0", until: "10.11.0" },
    ],
    features: [
      { id: "auth.header", area: "auth", critical: true, label: label("auth") },
      { id: "segments.api", area: "segments", label: label("segments"), endpoints: ["GET /MediaSegments/{itemId}"] },
      { id: "items.collections", area: "items", label: label("collections"), since: "12.0.0" },
      { id: "extras.trailers", area: "extras", label: label("trailers") },
    ],
    versions: [
      { version: "10.11.8", verdict: "ok", tentacle: { server: "1.21.0" }, features: { "auth.header": "ok", "segments.api": "ok", "extras.trailers": "ok" } },
      {
        version: "12.1.0",
        verdict: "partial",
        minTentacle: "1.22.0",
        features: {
          "auth.header": "ok",
          "segments.api": "ok",
          "items.collections": "ok",
          "extras.trailers": { verdict: "unsupported", note: { fr: "bandes-annonces locales absentes", en: "no local trailers" } },
        },
      },
      { version: "10.10.7", verdict: "fail", features: { "auth.header": "fail" } },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.manifest;
}

describe("verdict dérivé des résultats", () => {
  const catalogue = manifest().features;

  it("échec d'une fonctionnalité critique → fail ; d'une autre → partial", () => {
    expect(deriveTestedVerdict({ "auth.header": { verdict: "fail", checks: null, failed: null, note: null } }, catalogue)).toBe("fail");
    expect(deriveTestedVerdict({ "segments.api": { verdict: "fail", checks: null, failed: null, note: null } }, catalogue)).toBe("partial");
  });

  it("unsupported compte comme un manque ; tout ok → ok", () => {
    expect(deriveTestedVerdict({ "extras.trailers": { verdict: "unsupported", checks: null, failed: null, note: null } }, catalogue)).toBe("partial");
    expect(deriveTestedVerdict({ "auth.header": { verdict: "ok", checks: 3, failed: 0, note: null } }, catalogue)).toBe("ok");
  });

  it("chaque verdict du manifeste de test est celui que la règle en tire", () => {
    const data = manifest();
    for (const entry of data.versions) expect(deriveTestedVerdict(entry.features, data.features)).toBe(entry.verdict);
  });
});

describe("verdict d'une version", () => {
  it("version éprouvée : son verdict, ses fonctionnalités, sans celles qui n'existent pas encore", () => {
    const result = resolveCompat(manifest(), "10.11.8", "1.21.0");
    expect(result).toMatchObject({ status: "compatible", reason: "tested", line: "10.11", basis: { version: "10.11.8" } });
    expect(result.features.map((f) => f.id)).toEqual(["auth.header", "segments.api", "extras.trailers"]);
    expect(result.gaps).toEqual([]);
  });

  it("« 12.1 » de GitHub retrouve la « 12.1.0 » éprouvée ; les manques sont listés avec leur note", () => {
    const result = resolveCompat(manifest(), "12.1", "1.22.0");
    expect(result.status).toBe("partial");
    expect(result.gaps.map((gap) => [gap.id, gap.state, gap.note?.fr])).toEqual([
      ["extras.trailers", "unsupported", "bandes-annonces locales absentes"],
    ]);
    expect(result.tentacleTooOld).toBe(false);
  });

  it("un serveur Tentacle trop ancien pour le verdict est signalé", () => {
    expect(resolveCompat(manifest(), "12.1.0", "1.21.0")).toMatchObject({ minTentacle: "1.22.0", tentacleTooOld: true });
    expect(resolveCompat(manifest(), "12.1.0")).toMatchObject({ tentacleTooOld: false });
  });

  it("une sœur non éprouvée de la lignée : « compatible, non testée », d'après la plus proche en dessous", () => {
    const result = resolveCompat(manifest(), "10.11.11");
    expect(result).toMatchObject({ status: "presumed", reason: "line", basis: { version: "10.11.8", verdict: "ok" } });
  });

  it("sans sœur en dessous, la première au-dessus sert de référence", () => {
    const result = resolveCompat(manifest(), "12.0.0");
    expect(result).toMatchObject({ status: "presumed", basis: { version: "12.1.0" } });
  });

  it("une fonctionnalité apparue après la version est sans objet ; une autre absente du relevé est « non testée »", () => {
    const data = manifest();
    data.features.push({ id: "late.feature", area: "late", critical: false, label: label("late"), endpoints: [], since: "12.2.0" });
    data.features.push({ id: "new.check", area: "new", critical: false, label: label("new"), endpoints: [], since: null });
    const ids = resolveCompat(data, "12.1.0").features.map((f) => [f.id, f.state]);
    expect(ids).not.toContainEqual(["late.feature", expect.anything()]);
    expect(ids).toContainEqual(["new.check", "untested"]);
  });

  it("une sœur en échec ne présume rien : non testée", () => {
    expect(resolveCompat(manifest(), "10.10.9")).toMatchObject({ status: "untested", reason: "line", basis: { verdict: "fail" } });
  });

  it("la version éprouvée en échec est incompatible", () => {
    expect(resolveCompat(manifest(), "10.10.7").status).toBe("incompatible");
  });

  it("sous le minimum : incompatible, sans rien à montrer d'autre", () => {
    expect(resolveCompat(manifest(), "10.9.11")).toMatchObject({ status: "incompatible", reason: "below-minimum", features: [] });
  });

  it("hors de toute lignée, ou sans manifeste : non testée", () => {
    expect(resolveCompat(manifest(), "13.0")).toMatchObject({ status: "untested", reason: "unknown", basis: null });
    expect(resolveCompat(null, "10.11.8")).toMatchObject({ status: "untested", reason: "unknown", features: [] });
    expect(resolveCompat(manifest(), "12.0-rc7")).toMatchObject({ status: "untested", features: [] });
  });

  it("non testée : le catalogue reste listé, tout « non testé », sans ce qui n'existe pas encore", () => {
    const result = resolveCompat(manifest(), "13.0");
    expect(result.features.map((f) => [f.id, f.state])).toEqual([
      ["auth.header", "untested"], ["segments.api", "untested"], ["items.collections", "untested"], ["extras.trailers", "untested"],
    ]);
    expect(result.gaps).toEqual([]);
    expect(resolveCompat(manifest(), "10.11.99").features.map((f) => f.id)).toContain("segments.api");
  });
});
