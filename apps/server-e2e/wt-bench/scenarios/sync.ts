/**
 * La synchronisation pure, en lecture directe puis avec B en TRANSCODAGE
 * (débit plafonné : le geste « qualité basse » d'un utilisateur) : départ,
 * régime, pause / lecture / seek par chacun, onglet en arrière-plan.
 */

import { measureWindow, stats, waitAligned } from "../measure";
import type { ScenarioContext } from "./context";
import { gestureRealign, settlePast, startSession } from "./session";
import { INTRO_END_S } from "../media";

const LOW_BITRATE = 1_500_000;

export async function syncScenario(ctx: ScenarioContext, transcode: boolean): Promise<void> {
  const s = await startSession(ctx, transcode ? { b: { maxBitrate: LOW_BITRATE } } : {});
  ctx.check("B lit dans le mode visé",
    transcode ? s.b.mediaModes.has("transcode") : !s.b.mediaModes.has("transcode"),
    `A : ${[...s.a.mediaModes].join("+") || "?"} · B : ${[...s.b.mediaModes].join("+") || "?"}`);
  await settlePast(ctx, s, INTRO_END_S + 2);

  ctx.drift("régime (30 s)", stats(await measureWindow([s.a, s.b], 30_000)));

  await gestureRealign(ctx, s, "pause par B", () => s.b.setPlaying(false), { playing: false, withinMs: 50 });
  await new Promise((ok) => setTimeout(ok, 2000));
  await gestureRealign(ctx, s, "lecture par A", () => s.a.setPlaying(true), { playing: true });
  ctx.drift("après la reprise (10 s)", stats(await measureWindow([s.a, s.b], 10_000)));

  await gestureRealign(ctx, s, "pause par A", () => s.a.setPlaying(false), { playing: false, withinMs: 50 });
  await new Promise((ok) => setTimeout(ok, 1500));
  await gestureRealign(ctx, s, "lecture par B", () => s.b.setPlaying(true), { playing: true });

  await gestureRealign(ctx, s, "seek +30 s par B", () => s.b.press("ArrowRight"), { playing: true });
  ctx.drift("après le seek de B (10 s)", stats(await measureWindow([s.a, s.b], 10_000)));
  await gestureRealign(ctx, s, "seek −10 s par A", () => s.a.press("ArrowLeft"), { playing: true });
  await gestureRealign(ctx, s, "seek +30 s par A", () => s.a.press("ArrowRight"), { playing: true });

  // Scrub rapide : trois seeks en 600 ms, une seule reprise attendue.
  await gestureRealign(ctx, s, "scrub (→ ← → en 600 ms) par B", async () => {
    await s.b.press("ArrowRight");
    await new Promise((ok) => setTimeout(ok, 300));
    await s.b.press("ArrowLeft");
    await new Promise((ok) => setTimeout(ok, 300));
    await s.b.press("ArrowRight");
  }, { playing: true });

  // B passe en arrière-plan : un autre onglet au premier plan dans SON navigateur.
  const other = await s.b.context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  const hidden = await s.b.page.evaluate(() => document.visibilityState);
  ctx.log(`B en arrière-plan : visibilityState=${hidden}`);
  ctx.drift("B en arrière-plan (20 s)", stats(await measureWindow([s.a, s.b], 20_000)));
  await s.b.page.bringToFront();
  await other.close();
  const back = await waitAligned([s.a, s.b], { withinMs: 100, playing: true, since: Date.now(), timeoutMs: 20_000 });
  ctx.metric("retour au premier plan : réaligné (< 100 ms)", back.ms === null ? "jamais en 20 s" : `${back.ms} ms`, back.ms, "< 1 000 ms");
  ctx.drift("régime final (20 s)", stats(await measureWindow([s.a, s.b], 20_000)));
}
