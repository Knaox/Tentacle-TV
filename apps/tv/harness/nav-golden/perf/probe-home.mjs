// Diagnostic : l'accueil, carte par carte, avec la trace des événements de la zone.
import { benchContext } from "../lib/config.mjs";
import { prepare } from "../lib/session.mjs";
import { evaluate, agentRun, perform } from "../lib/remote.mjs";
import { coldStart } from "../lib/session.mjs";
const fixtures = (process.argv[2] ?? "focus/home,perf/apercus-distincts").split(",");
const ctx = benchContext({});
const session = await prepare(ctx, { at: process.env.AT ?? null, erase: false });
await coldStart(ctx, session, { fixtures });
await evaluate(ctx, `globalThis.__navGolden.navigate("Home", null, false)`);
for (const g of ["wait:1", "left", "right", "down"]) { await perform(ctx, g); await new Promise((r) => setTimeout(r, 400)); }
await new Promise((r) => setTimeout(r, 1500));
for (let i = 0; i < 4; i++) {
  await evaluate(ctx, `globalThis.__perf.arm("fps"), 1`);
  await agentRun(ctx, ["right"]);
  await new Promise((r) => setTimeout(r, 4000));
  await evaluate(ctx, `globalThis.__perf.disarm()`);
  await new Promise((r) => setTimeout(r, 500));
  const rows = await evaluate(ctx, `(() => { const r = globalThis.__perf.report(); const t0 = (r.focus[r.focus.length-1]||[r.armedAt])[0]; return r.events.filter(e => !/Focus|Blur/.test(e[2])).map(e => [e[0]-t0, e[2], ((r.about[e[1]]||{}).names||[]).slice(0,5).join("<")]); })()`);
  console.log(`carte ${i + 2}:`, JSON.stringify(rows));
}
process.exit(0);
