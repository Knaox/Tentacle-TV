#!/usr/bin/env node
/**
 * Résume un `rapport.json` du banc : les défauts regroupés par ENCRE (la classe de couleur qui porte
 * le texte), tous écrans confondus — c'est ce tableau qui dit quel JETON corriger.
 *
 *   node bench/clair-verre/resume.mjs <rapport.json> [--detail <motif d'encre>]
 */
import { readFileSync } from "node:fs";

const [file, flag, pattern] = process.argv.slice(2);
const { report, theme, glass } = JSON.parse(readFileSync(file, "utf8"));
const INKS = /\b(text-(?:content|on-media|accent|status|danger|white|black|brand)[\w-]*(?:\/\d+)?|chip(?:-[\w-]+)?|btn-[\w-]+|ui-[\w-]+|lgc?-[\w-]+|icon-btn|field[\w-]*|text-\[[^\]]+\]|placeholder[\w:-]*)\b/g;
const groups = new Map();
for (const scene of report) {
  for (const g of scene.groups ?? []) {
    const last = g.path.split(" > ").slice(-2).join(" > ");
    const inks = [...new Set(last.match(INKS) ?? [])].filter((c) => !/^text-\[\d/.test(c));
    const ink = `${g.kind} ${inks.slice(-2).join(" ") || "(hérité)"}`;
    const key = `${ink} | ${g.fg} sur ${g.bg}`;
    const entry = groups.get(key) ?? { ink, fg: g.fg, bg: g.bg, ratio: g.ratio, threshold: g.threshold, count: 0, scenes: new Set(), samples: new Set(), paths: new Set() };
    entry.count += g.count;
    entry.ratio = Math.min(entry.ratio, g.ratio);
    entry.scenes.add(scene.scene);
    for (const s of g.samples) entry.samples.add(s);
    entry.paths.add(g.path);
    groups.set(key, entry);
  }
}
const rows = [...groups.values()].sort((a, b) => b.count - a.count);
console.log(`thème ${theme}${glass ? " + verre" : ""} — ${rows.length} couples distincts, ${rows.reduce((n, r) => n + r.count, 0)} relevés en défaut`);
for (const r of rows) {
  if (flag === "--detail" && !new RegExp(pattern).test(`${r.ink} ${r.fg} ${r.bg}`)) continue;
  console.log(`${String(r.count).padStart(4)}× ${r.ratio.toFixed(2)}<${r.threshold}  ${r.fg} sur ${r.bg}  ${r.ink}  [${[...r.scenes].slice(0, 5).join(", ")}${r.scenes.size > 5 ? `, +${r.scenes.size - 5}` : ""}]  « ${[...r.samples].slice(0, 3).join(" | ").slice(0, 90)} »`);
  if (flag === "--detail") for (const p of [...r.paths].slice(0, 4)) console.log(`        ${p}`);
}
