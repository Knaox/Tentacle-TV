/**
 * Des contrôles consignés au verdict d'une version : le rapport du passage
 * (`compat/reports/jellyfin-<version>.json`) et son entrée dans le manifeste
 * (`compat/jellyfin.json`, schéma tenu par `compatManifest.ts`).
 *
 * Verdict d'une fonctionnalité : `ok` si tous ses contrôles passent, `partial`
 * si l'un passe avec une réserve ou si une partie seulement échoue, `fail` si
 * tous échouent. Verdict de la version : la règle commune du manifeste
 * (`deriveTestedVerdict`), jamais une appréciation.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  parseCompatManifest,
  type FeatureResult,
  type LocalizedText,
  type TestedVersion,
} from "../../src/services/jellyfinCompat/compatManifest";
import { deriveTestedVerdict } from "../../src/services/jellyfinCompat/compatVerdict";
import { AREAS, FEATURES } from "./features";
import type { CheckRecord } from "./harness";

export interface RunMeta {
  version: string;
  image: string;
  ranAt: string;
  tentacleServer: string;
  commit: string;
  legacyAuth: boolean | null;
}

export interface RunReport {
  schema: 1;
  jellyfin: { version: string; image: string; legacyAuthorization: boolean | null };
  tentacle: { server: string; commit: string };
  ranAt: string;
  verdict: TestedVersion["verdict"];
  features: Array<{ id: string; area: string; verdict: FeatureResult["verdict"]; checks: number; failed: number; note: LocalizedText | null }>;
  checks: CheckRecord[];
}

export function readRecords(file: string): CheckRecord[] {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as CheckRecord);
}

function noteOf(records: CheckRecord[]): LocalizedText | null {
  const failed = records.filter((r) => r.status === "fail");
  const reserves = records.filter((r) => r.status === "partial");
  if (failed.length === 0 && reserves.length === 0) return null;
  const fr = [
    ...failed.map((r) => `« ${r.check} » en échec${r.note ? ` : ${r.note}` : ""}`),
    ...reserves.map((r) => `« ${r.check} » : ${r.note}`),
  ].join(" · ");
  const en = [
    ...failed.map((r) => `"${r.check}" failed${r.note ? `: ${r.note}` : ""}`),
    ...reserves.map((r) => `"${r.check}": ${r.note}`),
  ].join(" · ");
  return { fr: fr.slice(0, 600), en: en.slice(0, 600) };
}

/** Le verdict de chaque fonctionnalité jouée ; les autres sont sans objet (absentes). */
export function aggregate(records: CheckRecord[]): Record<string, FeatureResult> {
  const results: Record<string, FeatureResult> = {};
  for (const feature of FEATURES) {
    const mine = records.filter((r) => r.feature === feature.id);
    if (mine.length === 0) continue;
    const failed = mine.filter((r) => r.status === "fail").length;
    const partial = mine.some((r) => r.status === "partial");
    const verdict = failed === mine.length ? "fail" : failed > 0 || partial ? "partial" : "ok";
    results[feature.id] = { verdict, checks: mine.length, failed, note: noteOf(mine) };
  }
  return results;
}

export function buildReport(records: CheckRecord[], meta: RunMeta): RunReport {
  const results = aggregate(records);
  return {
    schema: 1,
    jellyfin: { version: meta.version, image: meta.image, legacyAuthorization: meta.legacyAuth },
    tentacle: { server: meta.tentacleServer, commit: meta.commit },
    ranAt: meta.ranAt,
    verdict: deriveTestedVerdict(results, FEATURES),
    features: FEATURES.filter((f) => results[f.id]).map((f) => ({ id: f.id, area: f.area, ...results[f.id] } as RunReport["features"][number])),
    checks: records,
  };
}

/**
 * Inscrit le passage dans le manifeste : catalogue et zones réécrits depuis le
 * code, entrée de CETTE version remplacée, `revision` + 1. Le fichier écrit est
 * relu par le lecteur strict : un manifeste fautif n'est jamais laissé.
 */
export function updateManifest(path: string, report: RunReport, minimum: string | null): number {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const parsed = parseCompatManifest(raw);
  if (!parsed.ok) throw new Error(`Manifeste illisible avant écriture : ${parsed.errors.join(" ; ")}`);
  const entry: TestedVersion = {
    version: report.jellyfin.version,
    image: report.jellyfin.image,
    ranAt: report.ranAt,
    tentacle: { server: report.tentacle.server, commit: report.tentacle.commit },
    minTentacle: null,
    verdict: report.verdict,
    features: Object.fromEntries(report.features.map(({ id, verdict, checks, failed, note }) => [id, { verdict, checks, failed, note }])),
  };
  const versions = [...parsed.manifest.versions.filter((v) => v.version !== entry.version), entry]
    .sort((a, b) => b.version.localeCompare(a.version, "en", { numeric: true }));
  const next = {
    ...(raw.$comment ? { $comment: raw.$comment } : {}),
    schema: parsed.manifest.schema,
    revision: parsed.manifest.revision + 1,
    generatedAt: report.ranAt,
    minimum: minimum ?? parsed.manifest.minimum,
    lines: parsed.manifest.lines,
    areas: AREAS,
    features: FEATURES,
    versions,
  };
  const check = parseCompatManifest(JSON.parse(JSON.stringify(next)));
  if (!check.ok) throw new Error(`Le manifeste produit serait refusé : ${check.errors.join(" ; ")}`);
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next.revision;
}
