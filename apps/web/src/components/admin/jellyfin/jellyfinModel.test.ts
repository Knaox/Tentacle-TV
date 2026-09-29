/**
 * Ce que la vue d'ensemble et Services disent de Jellyfin : les réponses du
 * serveur relues sans confiance, les verdicts expliqués, la dernière version
 * située, et les réglages recommandés (ton, avancement, langue proposée).
 */

import { describe, expect, it } from "vitest";
import type { CompatVersionView, SetupCheck } from "@tentacle-tv/shared";
import { explainVerdict, gapsOf, latestSituation, probeSummary } from "./compatPresentation";
import { readCompatReport, readSetupReport } from "./jellyfinReaders";
import { applyErrorKey, languageChoice, setupProgress, stateTone } from "./setupPresentation";

const label = (fr: string) => ({ fr, en: fr });

const view = (patch: Partial<CompatVersionView> = {}): CompatVersionView => ({
  version: "12.1.0",
  status: "partial",
  reason: "tested",
  basis: { version: "12.1.0", verdict: "partial", ranAt: "2026-09-29T11:00:00Z", tentacleServer: "1.21.0" },
  line: "12",
  minTentacle: null,
  tentacleTooOld: false,
  features: [
    { id: "auth", area: "auth", critical: true, label: label("Connexion"), state: "ok", note: null, since: null, endpoints: [], probe: null },
    { id: "seg", area: "segments", critical: false, label: label("Passages"), state: "ok", note: null, since: null, endpoints: ["GET /MediaSegments/{itemId}"], probe: { state: "present", missing: [] } },
    { id: "trl", area: "extras", critical: false, label: label("Bandes-annonces"), state: "unsupported", note: label("absentes"), since: null, endpoints: ["GET /Items/{itemId}/LocalTrailers"], probe: { state: "missing", missing: ["GET /Items/{itemId}/LocalTrailers"] } },
  ],
  ...patch,
});

describe("lecture des rapports", () => {
  it("un rapport de compatibilité complet passe, champ par champ", () => {
    const report = readCompatReport({
      checkedAt: "t",
      tentacleServer: "1.21.0",
      manifest: { revision: 3, generatedAt: null, source: "remote", remoteCheckedAt: null, remoteError: null, testedVersions: ["12.1.0"], areas: { auth: label("Connexion"), bad: 3 } },
      installed: { ...view(), serverName: "Maison", probes: "ok" },
      installedError: null,
      latest: { ...view({ version: "12.1" }), tag: "v12.1", publishedAt: null, url: "https://github.com/x", newer: false, checkedAt: null },
      latestError: null,
    });
    expect(report?.installed).toMatchObject({ version: "12.1.0", serverName: "Maison", probes: "ok", status: "partial" });
    expect(report?.installed?.features[2].probe).toEqual({ state: "missing", missing: ["GET /Items/{itemId}/LocalTrailers"] });
    expect(report?.manifest?.areas).toEqual({ auth: label("Connexion") });
    expect(report?.latest).toMatchObject({ tag: "v12.1", newer: false });
  });

  it("les mesures des bandes-annonces passent, et un manque de compatibilité mal formé est écarté", () => {
    const report = readSetupReport({
      checkedAt: "t",
      checks: [{
        id: "trailers",
        state: "todo",
        trailers: {
          titles: 120, withTmdb: 100, withTrailer: 30, sampled: false, tmdbBlocked: false, jellyseerr: true, refreshing: true,
          compatGaps: [{ label: label("Bandes-annonces locales"), note: label("vides") }, { label: "cassé" }],
        },
      }],
    });
    expect(report?.checks[0].trailers).toEqual({
      titles: 120, withTmdb: 100, withTrailer: 30, sampled: false, tmdbBlocked: false, jellyseerr: true, refreshing: true,
      compatGaps: [{ label: label("Bandes-annonces locales"), note: label("vides") }],
    });
  });

  it("une forme inattendue ne fait rien tomber", () => {
    expect(readCompatReport({ nope: true })).toBeNull();
    expect(readCompatReport({ checkedAt: "t", installed: { version: 12, status: "?" } })).toMatchObject({ installed: null, manifest: null, latest: null });
    expect(readSetupReport({ checkedAt: "t", checks: [{ id: "inconnu", state: "done" }, { id: "trickplay", state: "todo" }] })?.checks.map((c) => c.id)).toEqual(["trickplay"]);
  });
});

describe("verdicts expliqués", () => {
  it("support incomplet : combien de manques, et lesquels", () => {
    expect(explainVerdict(view(), "fr")).toEqual({ key: "explainPartial", values: { count: 1 } });
    expect(gapsOf(view()).map((f) => f.id)).toEqual(["trl"]);
  });

  it("compatible non testée : d'après quelle sœur, et ce qu'elle vaut", () => {
    const presumed = view({ status: "presumed", reason: "line", version: "12.2.0" });
    expect(explainVerdict(presumed, "fr")).toEqual({ key: "explainPresumed", values: { basis: "12.1.0" }, nested: { basisStatus: "basisPartial" } });
  });

  it("sous le minimum, et sans rien de connu", () => {
    expect(explainVerdict(view({ status: "incompatible", reason: "below-minimum" }), "fr").key).toBe("explainBelowMinimum");
    expect(explainVerdict(view({ status: "untested", reason: "unknown", basis: null }), "fr").key).toBe("explainUntested");
  });

  it("les sondes : combien de capacités confirmées, lesquelles manquent", () => {
    const summary = probeSummary(view());
    expect(summary).toMatchObject({ checked: 2, present: 1 });
    expect(summary?.missing.map((f) => f.id)).toEqual(["trl"]);
    expect(probeSummary(view({ features: [] }))).toBeNull();
  });

  it("la dernière version, vue depuis l'installée", () => {
    const base = { checkedAt: "t", tentacleServer: "", manifest: null, installedError: null, latestError: null };
    const installed = { ...view({ version: "10.11.8" }), serverName: null, probes: "ok" as const };
    const latest = { ...view({ version: "12.1" }), tag: "v12.1", publishedAt: null, url: "u", checkedAt: null };
    expect(latestSituation({ ...base, installed, latest: { ...latest, newer: true } })).toBe("update");
    expect(latestSituation({ ...base, installed: { ...installed, version: "12.1.0" }, latest: { ...latest, newer: false } })).toBe("current");
    expect(latestSituation({ ...base, installed: { ...installed, version: "12.2.0" }, latest: { ...latest, newer: false } })).toBe("ahead");
    expect(latestSituation({ ...base, installed: null, latest: { ...latest, newer: false } })).toBe("unknown");
  });
});

describe("réglages recommandés", () => {
  const check = (state: SetupCheck["state"], level: SetupCheck["level"] = "recommended") => ({ state, level });

  it("le ton suit l'état et l'importance", () => {
    expect(stateTone(check("todo", "essential"))).toBe("error");
    expect(stateTone(check("todo"))).toBe("warning");
    expect(stateTone(check("todo", "optional"))).toBe("info");
    expect(stateTone(check("done"))).toBe("success");
    expect(stateTone(check("not-needed"))).toBe("neutral");
  });

  it("l'avancement ne compte ni « pas nécessaire » ni l'inconnu ; un redémarrage attendu n'est pas fait", () => {
    const checks = ["done", "done", "todo", "pending-restart", "not-needed", "unknown"].map((state) => ({ state }) as SetupCheck);
    expect(setupProgress(checks)).toEqual({ done: 2, total: 4 });
  });

  it("la langue proposée : celle de l'interface, le pays du navigateur s'il la parle", () => {
    expect(languageChoice("fr", "fr-CA")).toMatchObject({ language: "fr", country: "CA" });
    expect(languageChoice("fr", "en-GB")).toMatchObject({ language: "fr", country: "FR" });
    expect(languageChoice("en", "en-GB")).toMatchObject({ language: "en", country: "GB" });
    expect(languageChoice("en-US", "")).toMatchObject({ language: "en", country: "US" });
    expect(languageChoice("fr", "fr-FR").label.toLowerCase()).toContain("fran");
  });

  it("un code d'échec inconnu se dit en termes génériques", () => {
    expect(applyErrorKey("busy")).toBe("applyError_busy");
    expect(applyErrorKey("<script>")).toBe("applyError_generic");
    expect(applyErrorKey(null)).toBe("applyError_generic");
  });
});
