/**
 * Séances MIXTES : des membres iOS (iPhone, iPad, par Hermes) avec ou sans
 * membre web. Le même déroulé que `sync.ts` — départ, régime, pause, lecture,
 * seek par chacun, arrière-plan — sur une interface commune de membre.
 *
 * Étape a du lot : iPhone (compte A) + iPad (compte B).
 * Étape d : iPhone (compte A) + web (compte B).
 */

import { writeFileSync } from "node:fs";
import type { WtInviteDto, WtRoomStateDto } from "../../../../packages/shared/src/types/watchTogether";
import { IosClient } from "../clients/iosClient";
import { WebClient, type PlayerSample } from "../clients/webClient";
import { screenshot } from "../clients/iosDevice";
import { measureOnce, measureWindow, waitAligned, waitFor, type Sampler } from "../measure";
import { INTRO_END_S } from "../media";
import { readSims, relaunchIosMember, ensureMetro } from "../devices/iosRig";
import type { ScenarioContext } from "./context";
import { resetResume } from "./group";

const WT = "/api/watch-together";

/** Ce qu'un scénario mixte demande à un membre, quelle que soit sa plateforme. */
interface Member extends Sampler {
  sample(): Promise<PlayerSample>;
  api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }>;
  setPlaying(playing: boolean): Promise<void>;
  seekBy(seconds: number): Promise<void>;
  open(path: string): Promise<void>;
  shot(tag: string): Promise<void>;
}

function iosMember(ctx: ScenarioContext, c: IosClient, udid: string): Member {
  return {
    label: c.label,
    sample: () => c.sample(),
    api: (m, p, b) => c.api(m, p, b),
    setPlaying: (p) => c.setPlaying(p),
    seekBy: (s) => c.action("seekBy", s),
    open: (path) => c.navigate(path),
    shot: async (tag) => screenshot(udid, `${ctx.outDir}/${tag}-${c.label}.png`),
  };
}

function webMember(ctx: ScenarioContext, c: WebClient): Member {
  return {
    label: c.label,
    sample: () => c.sample(),
    api: (m, p, b) => c.api(m, p, b),
    setPlaying: (p) => c.setPlaying(p),
    seekBy: async (s) => c.press(s > 0 ? "ArrowRight" : "ArrowLeft"),
    open: (path) => c.goto(path),
    shot: (tag) => c.screenshot(`${ctx.outDir}/${tag}-${c.label}.png`),
  };
}

async function leave(m: Member): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    const g = await m.api<WtRoomStateDto | null>("GET", `${WT}/group`);
    if (!g.json) return;
    await m.api("POST", `${WT}/group/leave`);
  }
}

async function realign(ctx: ScenarioContext, ms: Member[], name: string, gesture: () => Promise<void>, playing: boolean, jumpS?: number): Promise<void> {
  const before = await measureOnce(ms);
  const since = Date.now();
  await gesture();
  if (jumpS) {
    await waitFor(async () => {
      const p = await measureOnce(ms);
      const el = (p.at - before.at) / 1000;
      return ms.every((m) => Math.abs((p.pos[m.label] ?? 0) - ((before.pos[m.label] ?? 0) + (before.paused[m.label] ? 0 : el))) > Math.abs(jumpS) / 2);
    }, 20_000, 100);
  }
  const res = await waitAligned(ms, { withinMs: playing ? 100 : 60, playing, since, timeoutMs: 20_000, stable: 3, everyMs: 150 });
  ctx.metric(`${name} : réaligné (${playing ? "lecture" : "pause"})`, res.ms === null ? "jamais en 20 s" : `${res.ms} ms`, res.ms, playing ? "< 1 000 ms" : undefined);
}

/** Le déroulé commun : A (hôte) lance, B suit ; mesures de synchro. */
async function runPair(ctx: ScenarioContext, a: Member, b: Member, episode: string): Promise<void> {
  await leave(a);
  await leave(b);
  const created = await a.api<WtRoomStateDto>("POST", `${WT}/group`, {});
  ctx.check("A crée le groupe", created.status === 200, `HTTP ${created.status}`);
  await a.api("POST", `${WT}/group/invites`, { userIds: [ctx.state.users.b.id] });
  await new Promise((ok) => setTimeout(ok, 1500));
  await b.shot("invitation");
  const invites = await b.api<WtInviteDto[]>("GET", `${WT}/invites`);
  const inv = invites.json.find((i) => i.fromUserId === ctx.state.users.a.id);
  ctx.check("B a l'invitation", Boolean(inv));
  if (!inv) return;
  await b.api("POST", `${WT}/invites/${inv.inviteId}/respond`, { accept: true });

  const launchAt = Date.now();
  await a.open(`/watch/${episode}`);
  const onItem = await waitFor(async () => {
    const [sa, sb] = await Promise.all([a.sample(), b.sample()]);
    return sa.path === `/watch/${episode}` && sb.path === `/watch/${episode}` && sa.pos !== null && sb.pos !== null;
  }, 60_000, 300);
  ctx.check("B suit le lancement de A jusqu'au lecteur", onItem !== null, onItem === null ? undefined : `${onItem} ms`);
  // B a une reprise personnelle à 41,7 s : il doit partir de la position de la salle (0 s).
  const firstB = await waitFor(async () => !(await b.sample()).paused, 60_000, 200);
  const sb = await b.sample();
  ctx.check("B part de la position de la salle, pas de sa reprise (41,7 s)", firstB !== null && (sb.pos ?? 99) < 30,
    `B à ${sb.pos?.toFixed(1)} s au départ`);
  await a.shot("lancement");
  await b.shot("lancement");
  if (onItem === null) return;
  const start = await waitAligned([a, b], { withinMs: 100, playing: true, since: launchAt, timeoutMs: 60_000, stable: 4, everyMs: 150 });
  ctx.metric("départ : du lancement à l'alignement (< 100 ms)", start.ms === null ? "jamais en 60 s" : `${start.ms} ms`, start.ms);

  // L'intro se saute seule (réglages par défaut de l'hôte) : le régime commence après.
  await waitFor(async () => {
    const p = await measureOnce([a, b]);
    return (p.pos[a.label] ?? 0) > INTRO_END_S + 2 && (p.pos[b.label] ?? 0) > INTRO_END_S + 2;
  }, 60_000, 500);
  ctx.drift("régime (30 s)", await measureWindow([a, b], 30_000));
  await b.shot("regime");

  await realign(ctx, [a, b], "pause par B", () => b.setPlaying(false), false);
  await new Promise((ok) => setTimeout(ok, 1500));
  await realign(ctx, [a, b], "lecture par A", () => a.setPlaying(true), true);
  await realign(ctx, [a, b], "pause par A", () => a.setPlaying(false), false);
  await new Promise((ok) => setTimeout(ok, 1500));
  await realign(ctx, [a, b], "lecture par B", () => b.setPlaying(true), true);
  await realign(ctx, [a, b], "seek +30 s par B", () => b.seekBy(30), true, 30);
  ctx.drift("après le seek (10 s)", await measureWindow([a, b], 10_000));
  await realign(ctx, [a, b], "seek +30 s par A", () => a.seekBy(30), true, 30);
  ctx.drift("régime final (20 s)", await measureWindow([a, b], 20_000));
}

/** Étape a : iPhone (A) + iPad (B). */
export async function iosPairScenario(ctx: ScenarioContext): Promise<void> {
  await ensureMetro();
  const sims = readSims();
  const iph = await relaunchIosMember(sims.iphone, ctx.state.users.a, "IPH", "WT banc iPhone");
  const ipd = await relaunchIosMember(sims.ipad, ctx.state.users.b, "IPD", "WT banc iPad");
  await new Promise((ok) => setTimeout(ok, 8000));
  const a = iosMember(ctx, iph, sims.iphone);
  const b = iosMember(ctx, ipd, sims.ipad);
  await a.shot("accueil");
  await b.shot("accueil");
  const tok = await a.api<WtRoomStateDto | null>("GET", `${WT}/group`);
  ctx.check("l'iPhone parle au backend avec sa session", tok.status === 200, `HTTP ${tok.status}`);
  const episode = ctx.state.episodeIds[0];
  await resetResumeForToken(ctx, episode);
  try {
    await runPair(ctx, a, b, episode);
  } finally {
    await leave(a).catch(() => undefined);
    await leave(b).catch(() => undefined);
    for (const c of [iph, ipd]) writeFileSync(`${ctx.outDir}/console-${c.label}.txt`, c.logs.join("\n"));
    iph.close();
    ipd.close();
  }
}

/** Étape d : iPhone (A) + web (B). */
export async function iosWebScenario(ctx: ScenarioContext): Promise<void> {
  await ensureMetro();
  const sims = readSims();
  const iph = await relaunchIosMember(sims.iphone, ctx.state.users.a, "IPH", "WT banc iPhone");
  const web = await ctx.member(ctx.state.users.b, "WEB");
  await new Promise((ok) => setTimeout(ok, 8000));
  const a = iosMember(ctx, iph, sims.iphone);
  const b = webMember(ctx, web);
  const episode = ctx.state.episodeIds[1];
  await resetResumeForToken(ctx, episode);
  try {
    await runPair(ctx, a, b, episode);
  } finally {
    await leave(a).catch(() => undefined);
    writeFileSync(`${ctx.outDir}/console-${iph.label}.txt`, iph.logs.join("\n"));
    iph.close();
  }
}

/**
 * Les reprises Jellyfin avant le lancement : celle du LANCEUR (A) à zéro, la
 * séance part du début ; celle du compte qui SUIT (B) à 41,7 s — en séance, la
 * position de la salle doit l'emporter sur sa reprise personnelle (défaut M5).
 */
const FOLLOWER_RESUME_S = 41.7;
async function resetResumeForToken(ctx: ScenarioContext, itemId: string): Promise<void> {
  const helperA = await ctx.member(ctx.state.users.a, "RESET-A");
  await resetResume(helperA, ctx.state.jellyfinUrl, [itemId]);
  await ctx.release(helperA);
  const helperB = await ctx.member(ctx.state.users.b, "RESET-B");
  await resetResume(helperB, ctx.state.jellyfinUrl, [itemId], FOLLOWER_RESUME_S);
  await ctx.release(helperB);
}
