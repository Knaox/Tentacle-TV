// Diagnostic : la colonne tenue d'une grille après une touche maintenue — le focus relevé toutes les 250 ms après le lâcher.
import { benchContext } from "../lib/config.mjs";
import { coldStart, prepare } from "../lib/session.mjs";
import { agentRun, evaluate, perform } from "../lib/remote.mjs";
const ctx = benchContext({});
const session = await prepare(ctx, { at: process.env.AT ?? null, erase: false });
await coldStart(ctx, session, { fixtures: ["base/vigie-off", "ecrans/grande-bibliotheque", "perf/apercus-distincts"] });
await evaluate(ctx, `globalThis.__navGolden.navigate("Library", { libraryId: "db4c1708cbb5dd1676284a40f2950aba", libraryName: "Films" }, false)`);
await perform(ctx, "wait:6");
// La clé focalisée et le haut de son cadre (points) : une réclamation loin de l'écran se verrait à un haut hors de 0-1080.
const key = async () => {
  const f = (await evaluate(ctx, "globalThis.__navGolden.observe()"))?.focus;
  return f?.key ? `${f.key}@${Math.round(f.frame?.[1] ?? NaN)}` : String(f?.key);
};
for (const k of ["right", "right"]) { await agentRun(ctx, [k]); await new Promise((r) => setTimeout(r, 700)); }
console.log("départ", await key());
for (const hold of (process.env.HOLDS ?? "holddown:3,holdup:3").split(",")) {
  await agentRun(ctx, [hold]);
  const t0 = Date.now();
  const seen = [];
  while (Date.now() - t0 < 5000) { seen.push(`${Date.now() - t0}:${await key()}`); await new Promise((r) => setTimeout(r, 100)); }
  const keyOf = (s) => s.split(":").slice(1).join(":").split("@")[0];
  console.log(hold, seen.filter((s, i) => i === 0 || keyOf(s) !== keyOf(seen[i - 1])).join("  "));
}
process.exit(0);
