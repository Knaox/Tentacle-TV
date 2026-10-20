/**
 * Appuis martelés : cinq fois → (+30 s) à 80 ms d'écart. Seul, le lecteur web
 * avance de 150 s ; en séance, chaque appui doit compter aussi — le serveur ne
 * reçoit qu'UN `wt:seek` (le dernier, dé-bouncé), mais vers la cible cumulée.
 */

import { measureOnce, waitAligned, waitFor } from "../measure";
import { INTRO_END_S } from "../media";
import type { ScenarioContext } from "./context";
import { launch, leaveAny } from "./group";
import { settlePast, startSession } from "./session";

async function hammer(press: () => Promise<void>): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await press();
    await new Promise((ok) => setTimeout(ok, 80));
  }
}

export async function seekHammerScenario(ctx: ScenarioContext): Promise<void> {
  // Seul, hors séance : la référence du lecteur.
  const solo = await ctx.member(ctx.state.users.c ?? ctx.state.users.a, "S");
  await leaveAny(solo);
  await launch(solo, ctx.state.episodeIds[2]);
  await waitFor(async () => ((await solo.sample()).pos ?? 0) > INTRO_END_S + 2, 60_000, 300);
  const s0 = (await solo.sample()).pos ?? 0;
  await hammer(() => solo.press("ArrowRight"));
  await new Promise((ok) => setTimeout(ok, 3_000));
  const s1 = (await solo.sample()).pos ?? 0;
  ctx.metric("seul : 5 appuis → martelés, avance", `${(s1 - s0 - 3).toFixed(1)} s (attendu ≈ 150 s)`);
  await ctx.release(solo);

  // En séance.
  const s = await startSession(ctx);
  await settlePast(ctx, s, INTRO_END_S + 2);
  const g0 = (await measureOnce([s.a, s.b])).pos.A ?? 0;
  const at = Date.now();
  await hammer(() => s.a.press("ArrowRight"));
  await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: at, timeoutMs: 20_000 });
  await new Promise((ok) => setTimeout(ok, 1_000));
  const p = await measureOnce([s.a, s.b]);
  const advance = (p.pos.A ?? 0) - g0 - (p.at - at) / 1000;
  ctx.check("en séance : 5 appuis → martelés comptent tous (≈ +150 s)", advance > 140, `avance ${advance.toFixed(1)} s · A ${p.pos.A?.toFixed(1)} s · B ${p.pos.B?.toFixed(1)} s`);
}
