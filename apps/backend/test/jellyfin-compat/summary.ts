/** Le verdict d'un passage, lisible dans le terminal. */

import { compareJellyfinVersions } from "../../src/services/jellyfinCompat/compatManifest";
import { FEATURES } from "./features";
import type { RunReport } from "./report";

const MARK: Record<string, string> = { ok: "✓", partial: "◐", fail: "✗", unsupported: "∅" };

export function printSummary(report: RunReport, reportFile: string): void {
  const lines = [
    "",
    `Jellyfin ${report.jellyfin.version} — verdict : ${report.verdict.toUpperCase()}` +
      ` (auth héritée ${report.jellyfin.legacyAuthorization === null ? "sans option" : report.jellyfin.legacyAuthorization ? "acceptée" : "coupée"})`,
  ];
  for (const feature of FEATURES) {
    const result = report.features.find((f) => f.id === feature.id);
    if (!result) {
      const notYet = feature.since !== null && compareJellyfinVersions(report.jellyfin.version, feature.since) < 0;
      lines.push(`  ·  ${feature.id.padEnd(34)} ${notYet ? `sans objet (depuis Jellyfin ${feature.since})` : "NON TESTÉE"}`);
      continue;
    }
    const detail = `${result.checks - result.failed}/${result.checks}`;
    lines.push(`  ${MARK[result.verdict] ?? "?"}  ${feature.id.padEnd(34)} ${detail.padStart(5)}${result.note ? `  ${result.note.fr}` : ""}`);
  }
  lines.push(`Rapport : ${reportFile}`, "");
  console.log(lines.join("\n"));
}
