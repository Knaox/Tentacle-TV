/**
 * Un membre LENT à démarrer : B transcode et ses premières requêtes média
 * traînent. Personne ne doit partir sans lui, et l'intro AU TOUT DÉBUT ne
 * doit pas se sauter (ni proposer « Passer l'intro ») tant que tous ne sont
 * pas prêts — sinon le premier prêt entraîne la salle hors de l'intro
 * pendant que l'autre charge encore.
 */

import type { WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import type { WebClient } from "../clients/webClient";
import { measureOnce, measureWindow, waitAligned, waitFor } from "../measure";
import { INTRO_END_S } from "../media";
import type { ScenarioContext } from "./context";
import { createGroup, inviteAndAccept, launch, waitOnItem } from "./group";

const SLOW = { maxBitrate: 1_500_000, mediaDelayMs: 6_000, mediaDelayCount: 3 };
const SKIP_LABEL = /Passer l.intro/;

/** Jusqu'à ce que B lise vraiment : ce que A a fait entre-temps. */
async function watchUntilBPlays(a: WebClient, b: WebClient, timeoutMs: number) {
  let aMax = 0;
  let skipSeen = false;
  let bPlaysAt: number | null = null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = await measureOnce([a, b]);
    if (!p.paused.A) aMax = Math.max(aMax, p.pos.A ?? 0);
    if (await a.isVisible(SKIP_LABEL)) skipSeen = true;
    if (!p.paused.B && (p.pos.B ?? 0) > 0.05) {
      bPlaysAt = Date.now() - start;
      break;
    }
    await new Promise((ok) => setTimeout(ok, 150));
  }
  return { aMax, skipSeen, bPlaysAt };
}

async function slowSession(ctx: ScenarioContext) {
  const a = await ctx.member(ctx.state.users.a, "A");
  const b = await ctx.member(ctx.state.users.b, "B", SLOW);
  await createGroup(a);
  await inviteAndAccept(ctx, a, b, false);
  return { a, b };
}

export async function slowStartScenario(ctx: ScenarioContext): Promise<void> {
  const { a, b } = await slowSession(ctx);
  const launchAt = await launch(a, ctx.state.episodeIds[2]);
  const seen = await watchUntilBPlays(a, b, 90_000);
  ctx.metric("membre lent : délai avant que B lise", seen.bPlaysAt === null ? "jamais en 90 s" : `${seen.bPlaysAt} ms`, seen.bPlaysAt);
  ctx.check("A n'avance pas sans B (≤ 0,3 s de lecture avant que B lise)", seen.aMax <= 0.3, `A a lu jusqu'à ${seen.aMax.toFixed(2)} s`);
  ctx.check("B lit bien en transcodage", b.mediaModes.has("transcode"), [...b.mediaModes].join("+"));
  const res = await waitAligned([a, b], { withinMs: 100, playing: true, since: launchAt, timeoutMs: 90_000, stable: 4 });
  ctx.metric("membre lent : du lancement à l'alignement (< 100 ms)", res.ms === null ? "jamais" : `${res.ms} ms`, res.ms);
  await waitFor(async () => ((await measureOnce([a, b])).pos.A ?? 0) > INTRO_END_S + 2, 60_000, 500);
  ctx.drift("membre lent, régime (20 s)", await measureWindow([a, b], 20_000));
  // Un seek tombe hors du tampon du transcodage : le lent recharge, l'autre attend.
  const since = Date.now();
  const before = (await measureOnce([a, b])).pos.A ?? 0;
  await a.press("ArrowRight");
  await waitFor(async () => {
    const p = await measureOnce([a, b]);
    return (p.pos.A ?? 0) > before + 20 && (p.pos.B ?? 0) > before + 20;
  }, 30_000, 50);
  const back = await waitAligned([a, b], { withinMs: 100, playing: true, since, timeoutMs: 30_000, stable: 3 });
  ctx.metric("seek +30 s avec un membre en transcodage : réaligné", back.ms === null ? "jamais en 30 s" : `${back.ms} ms`, back.ms, "< 1 000 ms");
}

export async function introGateScenario(ctx: ScenarioContext): Promise<void> {
  // 1) Réglages par défaut de l'hôte : intro sautée seule après décompte.
  {
    const { a, b } = await slowSession(ctx);
    await launch(a, ctx.state.episodeIds[0]);
    const seen = await watchUntilBPlays(a, b, 90_000);
    ctx.check("[auto] aucun « Passer l'intro » chez A tant que B charge", !seen.skipSeen);
    ctx.check("[auto] la salle ne saute pas l'intro tant que B charge", seen.aMax < 2, `A est allé jusqu'à ${seen.aMax.toFixed(2)} s`);
    // Une fois tout le monde prêt, le saut se fait ENSEMBLE.
    const jumped = await waitFor(async () => {
      const p = await measureOnce([a, b]);
      return (p.pos.A ?? 0) >= INTRO_END_S && (p.pos.B ?? 0) >= INTRO_END_S;
    }, 40_000, 250);
    ctx.check("[auto] l'intro se saute une fois tous prêts, pour les deux", jumped !== null);
    if (jumped !== null) {
      const res = await waitAligned([a, b], { withinMs: 100, playing: true, since: Date.now(), timeoutMs: 10_000 });
      ctx.metric("[auto] après le saut commun : réaligné", res.ms === null ? "jamais" : `${res.ms} ms`, res.ms, "< 1 000 ms");
    }
    await ctx.dump("auto");
    for (const c of [a, b]) await c.close();
    ctx.clients.length = 0;
  }
  // 2) L'hôte « propose » (bouton) : A clique « Passer l'intro » dès qu'il le voit.
  {
    const { a, b } = await slowSession(ctx);
    const prefs = await a.api<Record<string, unknown>>("GET", "/api/preferences/playback");
    const settings = (prefs.json.settings ?? prefs.json) as Record<string, Record<string, unknown>>;
    const put = await a.api("PUT", "/api/preferences/playback", { ...settings, intro: { ...settings.intro, action: "button" } });
    ctx.log(`réglage « proposer » de l'hôte : HTTP ${put.status}`);
    await a.api("POST", "/api/watch-together/group/leave");
    await createGroup(a);
    await inviteAndAccept(ctx, a, b, false);
    await launch(a, ctx.state.episodeIds[1]);
    let clickedEarly = false;
    const start = Date.now();
    while (Date.now() - start < 90_000) {
      const p = await measureOnce([a, b]);
      const bReady = !p.paused.B && (p.pos.B ?? 0) > 0.05;
      if (bReady) break;
      if (await a.isVisible(SKIP_LABEL)) {
        clickedEarly = await a.clickText(SKIP_LABEL, 1_000);
        break;
      }
      await new Promise((ok) => setTimeout(ok, 150));
    }
    ctx.check("[bouton] « Passer l'intro » absent chez A tant que B charge", !clickedEarly);
    if (clickedEarly) {
      await new Promise((ok) => setTimeout(ok, 3_000));
      const p = await measureOnce([a, b]);
      const g = (await a.api<WtRoomStateDto | null>("GET", "/api/watch-together/group")).json;
      ctx.log(`après le clic précoce : A ${p.pos.A?.toFixed(2)} s, B ${p.pos.B?.toFixed(2)} s, salle ${((g?.positionTicks ?? 0) / 1e7).toFixed(2)} s`);
      ctx.check("[bouton] un clic précoce n'emmène pas la salle sans B", (p.pos.A ?? 0) < 2,
        `A ${p.pos.A?.toFixed(2)} s · B ${p.pos.B?.toFixed(2)} s`);
    }
    await waitOnItem([a, b], ctx.state.episodeIds[1], 60_000);
    // Après un clic précoce, l'intro est déjà passée : plus rien à proposer.
    const shown = clickedEarly ? null : await waitFor(() => a.isVisible(SKIP_LABEL), 20_000);
    if (!clickedEarly) ctx.check("[bouton] « Passer l'intro » paraît une fois tous prêts", shown !== null);
    if (shown !== null) {
      const since = Date.now();
      await b.clickText(SKIP_LABEL, 3_000);
      const res = await waitAligned([a, b], { withinMs: 100, playing: true, since, timeoutMs: 15_000 });
      const p = await measureOnce([a, b]);
      ctx.check("[bouton] le saut de B emmène les deux après l'intro", (p.pos.A ?? 0) >= INTRO_END_S - 1 && (p.pos.B ?? 0) >= INTRO_END_S - 1,
        `A ${p.pos.A?.toFixed(1)} s · B ${p.pos.B?.toFixed(1)} s`);
      ctx.metric("[bouton] saut manuel : réaligné", res.ms === null ? "jamais" : `${res.ms} ms`, res.ms, "< 1 000 ms");
    }
    // Remettre le réglage par défaut de l'hôte pour les scénarios suivants.
    await a.api("PUT", "/api/preferences/playback", settings);
  }
}
