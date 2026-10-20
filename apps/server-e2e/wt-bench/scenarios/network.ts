/**
 * Départ et retour réseau : B perd le réseau 10 s (navigateur hors ligne :
 * requêtes ET socket), puis le retrouve. Attendu : B reste membre, la salle
 * ne se dissout pas, B se recale tout seul au retour.
 */

import type { WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import { measureOnce, measureWindow, stats, waitAligned } from "../measure";
import { INTRO_END_S } from "../media";
import type { ScenarioContext } from "./context";
import { settlePast, startSession } from "./session";

const WT = "/api/watch-together";

export async function networkScenario(ctx: ScenarioContext): Promise<void> {
  const s = await startSession(ctx);
  await settlePast(ctx, s, INTRO_END_S + 2);

  for (const outageS of [10, 35]) {
    const before = await measureOnce([s.a, s.b]);
    await s.b.setOffline(true);
    ctx.log(`B hors ligne ${outageS} s (A à ${before.pos.A?.toFixed(1)} s)`);
    await new Promise((ok) => setTimeout(ok, outageS * 1000));
    const during = await measureOnce([s.a, s.b]);
    ctx.log(`fin de coupure : A ${during.pos.A?.toFixed(1)} s (${during.paused.A ? "pause" : "lecture"}), B ${during.pos.B?.toFixed(1)} s (${during.paused.B ? "pause" : "lecture"})`);
    const backAt = Date.now();
    await s.b.setOffline(false);
    const res = await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: backAt, timeoutMs: 30_000, stable: 3 });
    ctx.metric(`coupure de ${outageS} s : réaligné après le retour`, res.ms === null ? "jamais en 30 s" : `${res.ms} ms`, res.ms, "< 5 000 ms");
    const g = (await s.a.api<WtRoomStateDto | null>("GET", `${WT}/group`)).json;
    ctx.check(`coupure de ${outageS} s : B toujours membre, groupe intact`,
      Boolean(g?.members.some((m) => m.userId === ctx.state.users.b.id)), `${g?.members.length ?? 0} membre(s)`);
    ctx.check(`coupure de ${outageS} s : A n'a pas été arrêté par la coupure de B`, !during.paused.A);
    const diss = s.b.received("wt:dissolved");
    ctx.check(`coupure de ${outageS} s : B n'a pas reçu « dissous »`, diss.length === 0);
    if (res.ms !== null) ctx.drift(`après la coupure de ${outageS} s (10 s)`, stats(await measureWindow([s.a, s.b], 10_000)));
  }
}
