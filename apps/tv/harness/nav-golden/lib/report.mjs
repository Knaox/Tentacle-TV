// Le rapport lisible : une ligne par scénario au fil de l'eau, puis le détail
// des écarts (pas, champ, référence, observé), en Markdown et en JSON dans
// `out/` (ignoré par git).
import fs from "node:fs";
import path from "node:path";
import { OUT_DIR, duration, say } from "./config.mjs";

const MARK = {
  ok: "✓", recorded: "●", diff: "✗", expect: "≠", stale: "~", missing: "∅", error: "!", flaky: "≈", precondition: "?", skipped: "-",
};
const LABEL = {
  ok: "identique à la référence",
  recorded: "enregistré",
  diff: "ÉCART avec la référence",
  expect: "attendu de l'auteur contredit",
  stale: "identique, mais le scénario a changé depuis sa référence (réenregistrer)",
  missing: "pas de référence (record d'abord)",
  error: "le banc n'a pas pu le jouer",
  flaky: "INSTABLE : deux passages diffèrent sur la clé, la route ou les écritures",
  precondition: "approche ratée (start.focus / start.screen)",
  skipped: "ignoré",
};
export const FAILING = new Set(["diff", "expect", "missing", "error", "flaky", "precondition"]);

const show = (value) => (value === null || value === undefined ? "∅" : typeof value === "string" ? value : JSON.stringify(value));
const gesture = (g) => (g === undefined ? "" : ` « ${[].concat(g).join(" ")} »`);

function detailLines(result) {
  const lines = [];
  for (const d of (result.diffs ?? []).slice(0, 12)) {
    lines.push(`pas ${d.step}${gesture(d.do)} — ${d.field} : référence ${show(d.golden)} · observé ${show(d.observed)}`);
  }
  if ((result.diffs ?? []).length > 12) lines.push(`… et ${result.diffs.length - 12} autres écarts`);
  for (const f of result.expectFailures ?? []) lines.push(`pas ${f.step} — attendu ${f.field} : ${show(f.want)} · relevé ${show(f.got)}`);
  for (const p of result.preconditions ?? []) lines.push(`${p.field} : attendu ${show(p.want)} · relevé ${show(p.got)}`);
  for (const [i, fields] of Object.entries(result.unstable?.steps ?? {})) lines.push(`pas ${Number(i) + 1} instable : ${fields.join(", ")}`);
  if (result.unstable?.start?.length) lines.push(`entrée instable : ${result.unstable.start.join(", ")}`);
  for (const n of (result.notes ?? []).slice(0, 4)) lines.push(`(note, non comptée) pas ${n.step} — ${n.field} : ${show(n.golden)} → ${show(n.observed)}`);
  if (result.error) lines.push(result.error);
  if (result.reason) lines.push(result.reason);
  return lines;
}

/** La ligne d'un scénario, au moment où il finit. */
export function printResult(result) {
  const time = result.durationMs ? ` (${duration(result.durationMs)})` : "";
  say(`  ${MARK[result.status] ?? "?"} ${result.suite.domain}/${result.suite.name}#${result.scenario.id}${time} — ${LABEL[result.status] ?? result.status}`);
  if (result.status !== "ok" && result.status !== "recorded") for (const line of detailLines(result)) say(`      ${line}`);
  return result;
}

/** Le bilan, et le rapport écrit. Rend le nombre de scénarios en échec. */
export function writeReport(mode, results, { session, startedAt }) {
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const failing = results.filter((r) => FAILING.has(r.status));
  const elapsed = Date.now() - startedAt;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const md = [
    `# nav-golden — ${mode} — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    "",
    `Code : ${session.checkout.label} · données ${session.snapshot.hash} · natif ${session.fingerprint} · ${session.deviceInfo.name} (${session.deviceInfo.model}, ${session.deviceInfo.runtime})`,
    `Durée : ${duration(elapsed)} pour ${results.length} scénario(s) — ${Object.entries(counts).map(([k, v]) => `${v} ${LABEL[k] ?? k}`).join(", ")}`,
    "",
    ...results.flatMap((r) => [
      `- ${MARK[r.status]} \`${r.suite.domain}/${r.suite.name}#${r.scenario.id}\` — ${r.scenario.title} — **${LABEL[r.status]}**${r.durationMs ? ` (${duration(r.durationMs)})` : ""}`,
      ...(r.status === "ok" || r.status === "recorded" ? [] : detailLines(r).map((line) => `    - ${line}`)),
    ]),
    "",
  ].join("\n");
  const file = path.join(OUT_DIR, `${mode}-${stamp}`);
  fs.writeFileSync(`${file}.md`, md);
  fs.writeFileSync(`${file}.json`, JSON.stringify(results.map(({ suite, scenario, ...rest }) => ({ target: `${suite.domain}/${suite.name}#${scenario.id}`, title: scenario.title, ...rest })), null, 2));
  say();
  say(`${mode} : ${results.length} scénario(s) en ${duration(elapsed)} — ${Object.entries(counts).map(([k, v]) => `${MARK[k]} ${v} ${k}`).join(" · ")}`);
  say(`rapport : ${path.relative(process.cwd(), `${file}.md`)}`);
  return failing.length;
}
