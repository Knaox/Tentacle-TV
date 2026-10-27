// Banc lg8 — le rapport : un résumé clip × état (pires contrastes, échecs), puis
// le détail clip × élément × contraste × verdict. Seuils : texte 4,5:1, glyphes et barre 3:1.
import { THRESHOLD } from "./contrast.mjs";

const fmt = (v) => (v == null ? "—" : v.toFixed(2));
const cell = (s) => String(s ?? "").replace(/\|/g, "/");

function worst(rows, kind) {
  const values = rows.filter((r) => r.kind === kind && r.measured).map((r) => r.contrast);
  return values.length ? Math.min(...values) : null;
}

export function report(meta, rows) {
  const lines = [
    `# Banc lg8 — lisibilité du lecteur (fenêtre active)`,
    "",
    `- ${meta.date} · branche \`${meta.branch}\` @ ${meta.commit} · verre : \`${meta.mode ?? "?"}\``,
    `- Seuils : texte ≥ ${THRESHOLD.texte}:1 ; glyphes et barre ≥ ${THRESHOLD.glyphe}:1. Contraste = premier plan (médiane du cœur des traits) contre le fond le PLUS défavorable sous l'élément (90e centile s'il est clair, 10e s'il est sombre) ; « médian » = contre le fond médian.`,
    ...(meta.skipped.length ? [`- Non mesuré : ${meta.skipped.join(" ; ")}`] : []),
    "",
    "## Résumé",
    "",
    "| Clip | État | Texte (pire) | Glyphe (pire) | Barre (pire) | Échecs | Éléments |",
    "|---|---|---|---|---|---|---|",
  ];
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.clip}|${r.state}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  let failures = 0;
  for (const [key, list] of groups) {
    const [clip, state] = key.split("|");
    const fails = list.filter((r) => r.verdict === "ÉCHEC");
    failures += fails.length;
    const names = fails.slice(0, 4).map((r) => cell(r.name)).join(", ") + (fails.length > 4 ? "…" : "");
    lines.push(`| ${clip} | ${state} | ${fmt(worst(list, "texte"))} | ${fmt(worst(list, "glyphe"))} | ${fmt(worst(list, "barre"))} | ${fails.length}${names ? ` (${names})` : ""} | ${list.filter((r) => r.measured).length} |`);
  }
  lines.push("", `**Total : ${failures} échec(s) sur ${rows.filter((r) => r.measured).length} mesures.**`, "");
  lines.push("## Détail", "", "| Clip | État | Élément | Type | Contraste | Médian | Verdict |", "|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const name = r.where && r.where !== r.name ? `${r.name} · ${r.where}` : r.name;
    lines.push(`| ${r.clip} | ${r.state} | ${cell(name)} | ${r.kind} | ${r.measured ? fmt(r.contrast) : "non mesuré"} | ${fmt(r.median)} | ${r.verdict} |`);
  }
  return `${lines.join("\n")}\n`;
}
