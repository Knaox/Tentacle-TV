/**
 * Une séance à deux prête à mesurer : A (hôte) et B, groupe formé, épisode
 * lancé, départ mesuré, intro passée — la boucle de dérive en régime.
 */

import type { WebClient, WebClientOptions } from "../clients/webClient";
import { measureOnce, waitAligned, waitFor, type DriftPoint } from "../measure";
import type { ScenarioContext } from "./context";
import { createGroup, inviteAndAccept, launch, waitOnItem } from "./group";

export interface Session {
  a: WebClient;
  b: WebClient;
  launchAt: number;
}

/** Le premier point où les deux lisent : l'écart au départ. */
function firstCommonPlay(points: DriftPoint[], labels: string[]): DriftPoint | undefined {
  return points.find((p) => labels.every((l) => p.paused[l] === false && p.drift[l] !== null && (p.pos[l] ?? 0) > 0.05));
}

export async function startSession(ctx: ScenarioContext, opts: { b?: WebClientOptions; episode?: number } = {}): Promise<Session> {
  const a = await ctx.member(ctx.state.users.a, "A");
  const b = await ctx.member(ctx.state.users.b, "B", opts.b ?? {});
  await createGroup(a);
  await inviteAndAccept(ctx, a, b);
  const itemId = ctx.state.episodeIds[opts.episode ?? 0];
  const launchAt = await launch(a, itemId);
  const onItem = await waitOnItem([a, b], itemId, 60_000);
  ctx.check("les deux membres arrivent sur le lecteur du titre lancé", onItem !== null, onItem === null ? "délai dépassé" : `${onItem} ms`);

  // Départ : jusqu'à 60 s (un transcodage démarre lentement).
  const start = await waitAligned([a, b], { withinMs: 100, playing: true, since: launchAt, timeoutMs: 60_000, stable: 4 });
  const first = firstCommonPlay(start.points, ["A", "B"]);
  ctx.metric("départ : écart au premier instant où les deux lisent", first ? `${first.drift.B} ms` : "—", first ? Math.abs(first.drift.B ?? 0) : null, "< 100 ms");
  ctx.metric("départ : du lancement à l'alignement (< 100 ms)", start.ms === null ? "jamais en 60 s" : `${start.ms} ms`, start.ms);
  return { a, b, launchAt };
}

/**
 * Laisse passer l'intro (sautée seule par les réglages par défaut de l'hôte)
 * et attend le régime : les deux au-delà de `afterS`, alignés.
 */
export async function settlePast(ctx: ScenarioContext, s: Session, afterS: number): Promise<void> {
  const reached = await waitFor(async () => {
    const p = await measureOnce([s.a, s.b]);
    return (p.pos.A ?? 0) > afterS && (p.pos.B ?? 0) > afterS && !p.paused.A && !p.paused.B;
  }, 90_000, 300);
  if (reached === null) ctx.log(`les deux n'ont pas dépassé ${afterS} s en 90 s`);
  await waitAligned([s.a, s.b], { withinMs: 60, playing: true, since: Date.now(), timeoutMs: 15_000 });
}

/** Un geste d'un membre, puis le délai jusqu'au réalignement (et l'état voulu). */
export async function gestureRealign(
  ctx: ScenarioContext,
  s: Session,
  name: string,
  gesture: () => Promise<void>,
  expect: { playing: boolean; withinMs?: number },
): Promise<number | null> {
  const since = Date.now();
  await gesture();
  const res = await waitAligned([s.a, s.b], { withinMs: expect.withinMs ?? 100, playing: expect.playing, since, timeoutMs: 20_000, stable: 3 });
  ctx.metric(`${name} : réaligné (${expect.playing ? "lecture" : "pause"}, < ${expect.withinMs ?? 100} ms)`,
    res.ms === null ? "jamais en 20 s" : `${res.ms} ms`, res.ms, expect.playing ? "< 1 000 ms" : undefined);
  // Les points qui suivent l'alignement : la dérive résiduelle juste après.
  return res.ms;
}
