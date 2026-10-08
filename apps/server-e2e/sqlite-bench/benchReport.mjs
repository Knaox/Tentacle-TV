// Le rapport ANONYME d'un passage du banc : durées, tailles, comptes, noms de tables et de
// routes — jamais une valeur, un nom de compte, un jeton ou une adresse. Lit ce que le
// scénario a laissé dans son dossier de relevés.
//
//   node benchReport.mjs <dossier-du-passage>   → markdown sur stdout
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const [dir] = process.argv.slice(2);
if (!dir) throw new Error("usage : node benchReport.mjs <dossier>");
const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : null);
const json = (name) => {
  const text = read(name);
  if (!text) return null;
  try {
    return JSON.parse(text.trim().split("\n").filter(Boolean).pop());
  } catch {
    return null;
  }
};
const s = (ms) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)} s`);
/** La taille d'un fichier dans un `ls -la` (le nom seul est connu : tentacle.db, ses copies). */
function sizeOf(listing, file) {
  const line = (listing ?? "").split("\n").find((l) => l.trim().endsWith(` ${file}`));
  const bytes = line ? Number(line.trim().split(/\s+/)[4]) : NaN;
  return Number.isFinite(bytes) ? `${(bytes / 1e6).toFixed(1)} Mo` : "—";
}
const files = (listing) => (listing ?? "").split("\n").map((l) => l.trim().split(/\s+/).pop()).filter((n) => n && /tentacle\.db|migrat|\.bak|database\.json/.test(n));

const out = [`# Banc SQLite — ${basename(dir)}`, ""];
const MODES = { normal: "machine du banc, sans bride", slow: "½ cœur", nas: "NAS lent simulé : ½ cœur, disque à 30 Mo/s et 400 IOPS" };
const mode = read("mode.txt")?.trim();
if (mode) out.push(`Serveur 1.25 : ${MODES[mode] ?? mode}`, "");
for (const [name, label] of [
  ["watch-summary.json", "Bascule 1.24 → 1.25"],
  ["kill-summary.json", "Migration tuée en pleine copie"],
  ["resume-summary.json", "Reprise après l'arrêt brutal"],
  ["remigrate-summary.json", "« Migrer à nouveau »"],
]) {
  const w = json(name);
  if (!w) continue;
  out.push(`## ${label}`, "");
  if (w.killed) out.push(`- arrêt brutal à ${w.killed.percent} % (après ${s(w.killed.t)})`);
  const banc = name === "watch-summary.json" ? Number(read("checksum-ms.txt") ?? "0") : 0;
  if (banc && w.clientCutMs !== null) {
    out.push(`- coupure vue par une application, **hors relevé du banc : ${s(w.clientCutMs - banc)}** (mesurée ${s(w.clientCutMs)}, dont ${s(banc)} d'empreinte MariaDB prise par le banc, 1.24 arrêtée)`);
  }
  out.push(
    `- coupure vue par une application (route authentifiée) : **${s(w.clientCutMs)}** (de ${s(w.apiDownAtMs)} à ${s(w.apiBackAtMs)})`,
    `- écran d'attente (\`database.state = migrating\`) : ${w.waitingScreenFromMs === null ? "jamais vu" : `de ${s(w.waitingScreenFromMs)} à ${s(w.waitingScreenUntilMs)}`}`,
    `- état final : ${w.finalState}${w.finalReason ? ` (${w.finalReason})` : ""} ; versions vues : ${w.versions.join(" → ") || "—"} ; statuts de l'API : ${w.apiStatuses.join(", ")}`,
    "",
  );
}

const summary = json("migration-summary.json");
if (summary?.report) {
  const r = summary.report;
  out.push("## Migration (rapport du serveur)", "",
    `- ${r.tables} tables, ${r.rows} lignes, en ${s(r.durationMs)} ; source ${r.sourceVersion}${r.sourceEmpty ? " (vide)" : ""}`,
    `- reportées en fond : ${r.deferred.join(", ") || "—"} ; non reconnues copiées : ${r.unrecognized.join(", ") || "—"}`,
    `- anciennes tables laissées : ${r.retired.join(", ") || "—"} ; refusées : ${r.refused.map((x) => `${x.table} (${x.reason})`).join(", ") || "—"}`,
    `- cache : ${summary.cache.phase} ; contrôle de l'ancienne base : ${summary.sourceCheck?.status ?? "—"} ; retrait proposé : ${summary.removal.kind}`,
    "");
}
const cache = read("cache-copy-seconds.txt");
const memory = read("memory-after-boot.txt");
const idle = read("memory-idle.txt");
const mb = (bytes) => (bytes ? `${(Number(bytes) / 1e6).toFixed(0)} Mo` : "—");
const before = read("data-before.txt");
const after = read("data-after.txt") ?? read("data-after-resume.txt") ?? read("data-after-remigrate.txt");
if (cache || memory || after) {
  out.push("## Mesures", "",
    `- copie du cache TMDB en fond, serveur en service : ${cache ? `${cache.trim()} s` : "—"}`,
    `- mémoire du conteneur juste après la bascule : ${memory?.trim() || "—"} ; au repos (cache copié, 30 s plus tard) : ${idle?.trim() || "—"}`,
    `- MariaDB source (données + index) : ${read("mariadb-size-mb.txt")?.trim() ?? "—"} Mo ; image 1.24.0 : ${mb(read("image-ref-bytes.txt")?.trim())} ; image éprouvée : ${mb(read("image-new-bytes.txt")?.trim())}`,
    `- tentacle.db : ${sizeOf(after, "tentacle.db")} ; dossier de données avant / après : ${(before ?? "").trim().split("\n").pop() || "—"} / ${(after ?? "").trim().split("\n").pop() || "—"}`,
    `- fichiers de la base après : ${files(after).join(", ") || "—"}`, "");
}
const killListing = read("data-after-kill.txt");
if (killListing) out.push("## Dossier de données juste après l'arrêt brutal", "", `- ${files(killListing).join(", ") || "aucun fichier de base"}`, "");
const intact = read("mariadb-intact.txt");
if (intact) out.push(`**MariaDB : ${intact.trim()}** (CHECKSUM TABLE de toutes les tables, avant / après)`, "");
for (const [name, label] of [["status-after-rollback.json", "Après le retour à 1.24 puis à 1.25"], ["status-after-remigrate.json", "Après « Migrer à nouveau »"], ["check-after-remigrate.json", "Écriture de la 1.24 retrouvée"]]) {
  const v = read(name);
  if (v) out.push(`- ${label} : \`${v.trim()}\``);
}
const vigie = [json("vigie-before-update.json"), json("vigie-offered.json"), read("vigie-update.txt"), json("vigie-after-update.json")];
if (vigie.some(Boolean)) {
  out.push("", "## Vigie", "",
    `- sous 1.25, AVANT mise à jour : ${vigie[0] ? `${vigie[0].version}, module serveur ${vigie[0].serverModule?.state ?? "?"} (${vigie[0].serverModule?.refusal ?? "—"})` : "—"}`,
    `- proposé par le registre local à la 1.25 : ${vigie[1] ? vigie[1].map((v) => v.version).join(", ") : "—"}`,
    `- mise à jour : ${vigie[2]?.trim() ?? "—"} ; ensuite : ${vigie[3] ? `${vigie[3].version}, module serveur ${vigie[3].serverModule?.state ?? "?"}` : "—"}`);
}
const titled = [
  ["api-compare.md", "## API juste après la bascule (Vigie 1.24.1 encore refusé)"],
  ["api-compare-vigie.md", "## API après la mise à jour de Vigie"],
  ["db-compare.md", "## Base, serveur en service (ses écritures depuis la bascule comprises)"],
  ["db-pristine.md", "## Base « à froid » : migration par la CLI, sans serveur (cache TMDB copié en fond seulement : vide ici)"],
];
for (const [name, title] of titled) {
  const v = read(name);
  if (v) out.push("", title, "", v.trim());
}
// Sous la 1.25 seule : les routes qui changent d'elles-mêmes entre deux relevés (les autres sont identiques).
const stability = read("api-stability-after.md");
if (stability) {
  const lines = stability.trim().split("\n");
  const moving = lines.filter((l) => l.startsWith("| `") && !/\| identique( \(|\s*\|$)/.test(l));
  out.push("", "## Stabilité sous la 1.25 (deux relevés à 20 s, même version, Vigie à jour)", "",
    moving.length ? [lines.find((l) => l.startsWith("| Route")), "|---|---|---|---|", ...moving].join("\n") : "Toutes les routes identiques d'un relevé à l'autre.");
}
console.log(out.join("\n"));
