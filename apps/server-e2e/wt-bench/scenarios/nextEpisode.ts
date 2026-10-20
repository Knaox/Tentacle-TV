/**
 * Fin d'épisode et épisode suivant : « épisode suivant » demandé par un
 * membre (raccourci N), puis la fin NATURELLE d'un épisode (générique,
 * décompte, enchaînement automatique des réglages de l'hôte) — les deux
 * membres doivent arriver ensemble sur le même épisode, alignés.
 */

import { measureOnce, waitAligned, waitFor } from "../measure";
import { INTRO_END_S } from "../media";
import type { ScenarioContext } from "./context";
import { settlePast, startSession } from "./session";

export async function nextEpisodeScenario(ctx: ScenarioContext): Promise<void> {
  const s = await startSession(ctx);
  const [, ep2, ep3] = ctx.state.episodeIds;
  await settlePast(ctx, s, INTRO_END_S + 2);

  // 1) B demande l'épisode suivant.
  const askAt = Date.now();
  await s.b.press("KeyN");
  const both2 = await waitFor(async () => {
    const [sa, sb] = await Promise.all([s.a.sample(), s.b.sample()]);
    return sa.path === `/watch/${ep2}` && sb.path === `/watch/${ep2}`;
  }, 30_000);
  ctx.check("« Épisode suivant » de B : les deux passent à l'épisode 2", both2 !== null, both2 === null ? undefined : `${both2} ms`);
  const al2 = await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: askAt, timeoutMs: 45_000, stable: 4 });
  ctx.metric("épisode suivant (manuel) : de la demande à l'alignement", al2.ms === null ? "jamais" : `${al2.ms} ms`, al2.ms);

  // 2) Fin naturelle de l'épisode 2 : des sauts ESPACÉS (un appui martelé se perd,
  // cf. scénario seek-hammer) jusqu'à 30 s de la fin.
  await settlePast(ctx, s, INTRO_END_S + 2);
  for (let i = 0; i < 12; i += 1) {
    const p0 = await measureOnce([s.a, s.b]);
    if ((p0.pos.A ?? 0) > 262) break;
    await s.a.press("ArrowRight");
    await waitAligned([s.a, s.b], { withinMs: 150, playing: true, since: Date.now(), timeoutMs: 10_000, stable: 2 });
  }
  const p = await measureOnce([s.a, s.b]);
  ctx.log(`avant la fin : A ${p.pos.A?.toFixed(1)} s, B ${p.pos.B?.toFixed(1)} s`);
  const endAt = Date.now();
  const both3 = await waitFor(async () => {
    const [sa, sb] = await Promise.all([s.a.sample(), s.b.sample()]);
    return sa.path === `/watch/${ep3}` && sb.path === `/watch/${ep3}`;
  }, 90_000, 500);
  ctx.check("fin naturelle de l'épisode 2 : les deux enchaînent sur l'épisode 3", both3 !== null, both3 === null ? "aucun enchaînement en 90 s" : `${both3} ms`);
  if (both3 !== null) {
    const al3 = await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: endAt, timeoutMs: 60_000, stable: 4 });
    ctx.metric("enchaînement automatique : de la fin à l'alignement", al3.ms === null ? "jamais" : `${al3.ms} ms`, al3.ms);
  } else {
    const [sa, sb] = await Promise.all([s.a.sample(), s.b.sample()]);
    ctx.log(`état final : A ${sa.path} ${sa.pos?.toFixed(1)} s · B ${sb.path} ${sb.pos?.toFixed(1)} s`);
  }
}
