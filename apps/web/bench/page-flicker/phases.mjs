#!/usr/bin/env node
/**
 * Où tombent les images signalées d'une passe ? — d'après les `lignes.json` gardés par le banc.
 *
 *   node bench/page-flicker/phases.mjs <dossier de --out> <préfixe, ex. dark-slow>
 *
 * Trois temps : PENDANT LA TENUE (la page quittée est encore seule à l'écran : ce qui change,
 * c'est elle), PENDANT LE FONDU (les 160 ms qui suivent la révélation : la transition
 * elle-même), APRÈS (la page d'arrivée, montrée, finit de charger).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [root, prefix] = process.argv.slice(2);
const FADE_MS = 160;
const total = { held: 0, fade: 0, after: 0 };
for (const dir of readdirSync(root).filter((name) => name.startsWith(prefix)).sort()) {
  const { rows, probe } = JSON.parse(readFileSync(join(root, dir, "lignes.json"), "utf8"));
  const frames = probe.frames.filter((f) => !f.error);
  const mark = probe.marks.find((m) => m.label === "pointerdown" || m.label.startsWith("go "));
  const start = mark ? mark.t : frames[0]?.t ?? 0;
  const heldFrames = frames.filter((f) => f.t > start && f.pages?.some((p) => p.held));
  const revealAt = heldFrames.length > 0 ? heldFrames[heldFrames.length - 1].t - start : 0;
  const count = { held: 0, fade: 0, after: 0 };
  for (const row of rows) {
    if (row.flag === "") continue;
    if (row.ms < revealAt) count.held += 1;
    else if (row.ms <= revealAt + FADE_MS) count.fade += 1;
    else count.after += 1;
  }
  for (const key of Object.keys(total)) total[key] += count[key];
  console.log(`${dir.padEnd(48)} révélée à ${String(Math.round(revealAt)).padStart(5)} ms   tenue ${String(count.held).padStart(3)}   fondu ${String(count.fade).padStart(3)}   après ${String(count.after).padStart(3)}`);
}
console.log(`${"TOTAL".padEnd(48)}                      tenue ${String(total.held).padStart(3)}   fondu ${String(total.fade).padStart(3)}   après ${String(total.after).padStart(3)}`);
