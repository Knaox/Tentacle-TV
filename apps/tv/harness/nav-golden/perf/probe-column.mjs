// Diagnostic : la colonne tenue d'une grille après une touche maintenue — le focus relevé toutes les 250 ms après le lâcher.
import { benchContext } from "../lib/config.mjs";
import { coldStart, prepare } from "../lib/session.mjs";
import { agentRun, evaluate, perform } from "../lib/remote.mjs";
const ctx = benchContext({});
const session = await prepare(ctx, { at: process.env.AT ?? null, erase: false });
await coldStart(ctx, session, { fixtures: ["base/vigie-off", "ecrans/grande-bibliotheque", "perf/apercus-distincts"] });
await evaluate(ctx, `globalThis.__navGolden.navigate("Library", { libraryId: "db4c1708cbb5dd1676284a40f2950aba", libraryName: "Films" }, false)`);
await perform(ctx, "wait:6");
const key = async () => (await evaluate(ctx, "globalThis.__navGolden.observe()"))?.focus?.key;
for (const k of ["right", "right"]) { await agentRun(ctx, [k]); await new Promise((r) => setTimeout(r, 700)); }
console.log("départ", await key());
for (const hold of (process.env.HOLDS ?? "holddown:3,holdup:3").split(",")) {
  await agentRun(ctx, [hold]);
  const t0 = Date.now();
  const seen = [];
  while (Date.now() - t0 < 5000) { seen.push(`${Date.now() - t0}:${await key()}`); await new Promise((r) => setTimeout(r, 250)); }
  console.log(hold, seen.filter((s, i) => i === 0 || s.split(":").slice(1).join(":") !== seen[i - 1].split(":").slice(1).join(":")).join("  "));
}
process.exit(0);
