#!/usr/bin/env node
/**
 * Chronologie du banc wt-bureau : fusionne les JSONL des deux clients autour
 * d'un instant T0 (ms), et n'imprime que les CHANGEMENTS (pause, saut de
 * position > 1,5 s, route, avis, trames wt:*).
 *   node timeline.mjs <T0> <avant-ms> <après-ms> bureau=<f1> web=<f2>
 */
import { readFileSync } from "node:fs";
const [t0s, beforeS, afterS, ...files] = process.argv.slice(2);
const t0 = Number(t0s), from = t0 - Number(beforeS), to = t0 + Number(afterS);
const rows = [];
for (const spec of files) {
  const [label, file] = spec.split("=");
  let last = null;
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const e = JSON.parse(line);
    if (e.at < from || e.at > to) { if (e.kind === "sample") last = e; continue; }
    const t = ((e.at - t0) / 1000).toFixed(2).padStart(7);
    if (e.kind === "sample") {
      const jump = last && last.pos != null && e.pos != null && Math.abs(e.pos - last.pos - (e.at - last.at) / 1000 * (last.paused ? 0 : 1)) > 1.5;
      if (!last || last.paused !== e.paused || jump || last.pos == null) rows.push([e.at, `${t} ${label.padEnd(6)} ${e.paused ? "PAUSE" : "lit  "} pos=${e.pos?.toFixed(2)}${jump ? ` (saut depuis ${last.pos?.toFixed(2)})` : ""}`]);
      last = e;
    } else if (e.kind === "in" || e.kind === "out") {
      // Trame peut-être tronquée par l'enregistreur : lecture tolérante.
      const pick = (re) => [...e.raw.matchAll(re)].map((m) => m.slice(1).join(":"));
      const members = pick(/"username":"([^"]+)"[^}]*?"online":(true|false)[^}]*?"buffering":(true|false)/g);
      const head = pick(/"(paused|pauseReason|waitCause|positionTicks|cause|allReady)":("?[^,"}]*"?)/g).slice(0, 7).join(" ");
      const extra = e.type === "wt:state" ? ` ${head} membres=${members.join(",")}` : ` ${e.raw.slice(0, 200)}`;
      rows.push([e.at, `${t} ${label.padEnd(6)} ${e.kind === "in" ? "←" : "→"} ${e.type}${extra}`]);
    } else rows.push([e.at, `${t} ${label.padEnd(6)} ${e.kind}: ${(e.text ?? e.route ?? "").slice(0, 250)}`]);
  }
}
rows.sort((a, b) => a[0] - b[0]).forEach((r) => console.log(r[1]));
