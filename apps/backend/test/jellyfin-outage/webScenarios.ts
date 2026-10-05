/**
 * Les pannes vues par le VRAI lecteur web (hls.js et `<video>` dans Chrome),
 * mesurées depuis la page : une sonde relève toutes les 200 ms la position,
 * l'état du `<video>`, le bandeau et l'écran d'erreur ; le faux Jellyfin note
 * chaque requête de média. Seuils de la passation : le bandeau en moins de
 * 10 s, aucune erreur, la lecture qui reprend seule en moins de 15 s après le
 * retour de Jellyfin, à la bonne position, avec la même piste audio.
 */

import type { Checks } from "../notif-e2e/checks";
import type { Chrome } from "./chrome";
import { sleep, type FakeJellyfin } from "./fakeJellyfin";
import type { FakeMedia } from "./fakeMedia";

export interface Sample {
  at: number;
  t: number | null;
  paused: boolean | null;
  rs: number | null;
  err: number | null;
  banner: string | null;
  state: string | null;
  problem: boolean;
}

/** Posé dans chaque document : la sonde de la page. */
export const PROBE = `
window.__bench = { samples: [], jellyfin: [] };
// Chaque état de Jellyfin REÇU par la page (au niveau du WebSocket) : la
// preuve que son canal est annoncé, et l'heure de réception, à part de l'affichage.
const NativeWebSocket = window.WebSocket;
window.WebSocket = class extends NativeWebSocket {
  constructor(...args) {
    super(...args);
    this.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.type === "server:jellyfin") window.__bench.jellyfin.push({ at: Date.now(), state: msg.state });
      } catch { /* trame non JSON (Vite) */ }
    });
  }
};
setInterval(() => {
  const v = document.querySelector("video");
  const b = document.querySelector("[data-jellyfin-outage]");
  window.__bench.samples.push({
    at: Date.now(), t: v ? v.currentTime : null, paused: v ? v.paused : null, rs: v ? v.readyState : null,
    err: v && v.error ? v.error.code : null, banner: b ? b.textContent.slice(0, 160) : null,
    state: b ? b.getAttribute("data-jellyfin-outage") : null, problem: !!document.querySelector("[data-playback-problem]"),
  });
}, 200);`;

export interface WebBench {
  chrome: Chrome;
  fake: FakeJellyfin;
  media: FakeMedia;
  checks: Checks;
  measures: Record<string, number | string | null>;
  /** Les relevés bruts de chaque scénario (t relatif au retour de Jellyfin), pour l'analyse. */
  traces: Record<string, Array<Sample & { rel: number }>>;
}

export async function drain(chrome: Chrome): Promise<Sample[]> {
  return chrome.evaluate<Sample[]>("const s = window.__bench ? window.__bench.samples : []; if (window.__bench) window.__bench.samples = []; return s;");
}

/** Attend que le canal de session de la page soit annoncé (premier `server:jellyfin` reçu). */
export async function waitChannel(chrome: Chrome, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await chrome.evaluate<boolean>("return !!window.__bench && window.__bench.jellyfin.length > 0;"))) {
    if (Date.now() > deadline) throw new Error("le canal de session de la page ne s'est pas annoncé");
    await sleep(100);
  }
}

/** Attend que la vidéo avance (au moins `seconds` de lecture). */
export async function waitPlaying(chrome: Chrome, seconds: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const t = await chrome.evaluate<number | null>("const v = document.querySelector('video'); return v && !v.paused ? v.currentTime : null;");
    if (t !== null && t >= seconds) return;
    if (Date.now() > deadline) throw new Error(`la lecture n'a pas atteint ${seconds} s`);
    await sleep(250);
  }
}

/**
 * Le premier relevé, après `from`, d'où la lecture AVANCE à vitesse normale
 * (0,4 à 1,6 s de film en 1,2 s, image prête). Un saut n'est pas une reprise :
 * un `<video>` remonté passe par 0 puis bondit à la position visée.
 */
function resumedAt(samples: Sample[], from: number): Sample | null {
  const after = samples.filter((s) => s.at >= from && s.t !== null && s.paused === false && (s.rs ?? 0) >= 3);
  for (let i = 0; i < after.length; i++) {
    const ahead = after.find((s) => {
      const dt = (s.t ?? 0) - (after[i].t ?? 0);
      return s.at > after[i].at && s.at - after[i].at <= 1_200 && dt >= 0.4 && dt <= 1.6;
    });
    if (ahead) return after[i];
  }
  return null;
}

function note(b: WebBench, key: string, label: string, value: number | null, max: number): void {
  b.measures[key] = value;
  b.checks.that(`${label} : ${value === null ? "jamais" : `${value} ms`} (seuil ${max} ms)`, value !== null && value <= max, value);
}

/** Une panne jouée pendant la lecture : `outage` agit sur le faux Jellyfin et rend quand il est revenu. */
export async function playThrough(b: WebBench, key: string, label: string, outage: () => Promise<void>, expected: string[]): Promise<void> {
  b.checks.begin(`Lecteur web — ${label}`);
  await drain(b.chrome);
  const before = await b.chrome.evaluate<number>("return document.querySelector('video').currentTime;");
  const t0 = Date.now();
  const mediaBefore = b.media.hits.length;
  await outage();
  const up = b.fake.upSince;
  await sleep(18_000);
  const samples = await drain(b.chrome);
  b.traces[key] = samples.map((s) => ({ ...s, rel: s.at - up }));
  const received = await b.chrome.evaluate<Array<{ at: number; state: string }>>("return window.__bench.jellyfin;");
  const firstReceived = received.find((m) => m.at >= t0 && m.state !== "up");
  b.measures[`${key}.received`] = firstReceived ? firstReceived.at - t0 : null;
  b.measures[`${key}.receivedStates`] = received.filter((m) => m.at >= t0).map((m) => m.state).join(" → ");
  const firstBanner = samples.find((s) => s.at >= t0 && s.banner !== null);
  note(b, `${key}.banner`, "bandeau affiché", firstBanner ? firstBanner.at - t0 : null, 10_000);
  const states = samples.filter((s) => s.state !== null).map((s) => s.state).filter((s, i, all) => s !== all[i - 1]);
  b.checks.that(`états du bandeau : ${expected.join(" → ")}`, JSON.stringify(states) === JSON.stringify(expected), states);
  const texts = [...new Set(samples.map((s) => s.banner).filter((s): s is string => s !== null))];
  b.measures[`${key}.texts`] = texts.join(" | ");
  b.checks.that("aucun écran d'erreur, à aucun moment", samples.every((s) => !s.problem), samples.filter((s) => s.problem).length);
  const resume = resumedAt(samples, up);
  note(b, `${key}.resume`, "lecture repartie après le retour de Jellyfin", resume ? resume.at - up : null, 15_000);
  const gone = samples.filter((s) => s.at >= up && s.banner !== null).at(-1);
  note(b, `${key}.bannerGone`, "bandeau retiré après le retour", gone ? gone.at - up : 0, 3_000);
  const lastBeforeStall = samples.filter((s) => s.at < up && s.t !== null).at(-1)?.t ?? before;
  // La panne a-t-elle VRAIMENT arrêté l'image ? (sinon la reprise n'est pas éprouvée)
  const during = samples.filter((s) => s.at >= t0 && s.at < up && s.t !== null);
  const frozenSince = during.find((s) => (s.t ?? 0) >= lastBeforeStall - 0.05);
  const stalledMs = frozenSince ? up - frozenSince.at : 0;
  b.measures[`${key}.stalledMs`] = stalledMs;
  b.checks.that(`l'image a calé pendant la panne (${(stalledMs / 1000).toFixed(1)} s) : la reprise est éprouvée`, stalledMs >= 2_000, stalledMs);
  b.measures[`${key}.position`] = `${before.toFixed(1)} s avant · ${lastBeforeStall.toFixed(1)} s au retour · ${(resume?.t ?? 0).toFixed(1)} s à la reprise`;
  b.checks.that(`reprise à la bonne position (${b.measures[`${key}.position`]})`,
    resume !== null && (resume.t ?? 0) >= before - 1 && Math.abs((resume.t ?? 0) - lastBeforeStall) <= 4, b.measures[`${key}.position`]);
  const after = b.media.hits.slice(mediaBefore).filter((h) => h.at >= up);
  b.measures[`${key}.requests`] = after.map((h) => `${h.kind}${h.query.get("PlaySessionId") ? `(${h.query.get("PlaySessionId")})` : ""}`).slice(0, 6).join(" ");
}

/** Le transcodage rouvert au retour : nouvelle session, MÊME piste audio. */
export function checkReopenedTranscode(b: WebBench, since: number, audio: string): void {
  const infos = b.media.hits.filter((h) => h.kind === "playbackinfo");
  const before = infos.filter((h) => h.at < since).at(-1);
  const after = infos.filter((h) => h.at >= since);
  const psids = after.map((h) => h.query.get("PlaySessionId"));
  b.checks.that("une nouvelle négociation (PlaybackInfo) après le retour", after.length > 0, after.length);
  b.checks.that(`nouvelle session (${before?.query.get("PlaySessionId")} → ${psids.join(",")})`,
    after.length > 0 && psids.every((p) => p !== before?.query.get("PlaySessionId")), psids);
  b.checks.that(`même piste audio (${audio}) redemandée`, after.length > 0 && after.every((h) => h.query.get("AudioStreamIndex") === audio),
    after.map((h) => h.query.get("AudioStreamIndex")));
  const segments = b.media.hits.filter((h) => h.kind === "segment" && h.at >= since);
  b.checks.that("les segments repartent sur la nouvelle session", segments.length > 0 && segments.every((h) => psids.includes(h.query.get("PlaySessionId"))),
    [...new Set(segments.map((h) => h.query.get("PlaySessionId")))]);
}

/**
 * L'épisode suivant, SANS recharger la page (comme « épisode suivant » : la
 * route change, la page reste) : B doit partir sur SES valeurs — sa piste
 * par défaut, aucune position héritée de A. Passation : « au changement
 * d'épisode, remettre à zéro… ne jamais repartir sur la piste d'avant ».
 */
export async function nextEpisode(b: WebBench, itemB: string): Promise<void> {
  b.checks.begin("Lecteur web — épisode suivant sans recharger la page");
  const since = Date.now();
  await b.chrome.evaluate(`history.pushState({}, "", "/watch/${itemB}"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await waitPlaying(b.chrome, 3, 60_000);
  const infos = b.media.hits.filter((h) => h.kind === "playbackinfo" && h.item === itemB && h.at >= since);
  const seen = infos.map((h) => `audio=${h.query.get("AudioStreamIndex")} début=${h.query.get("StartTimeTicks") || "0"}`);
  b.measures.nextEpisode = seen.join(" | ");
  b.checks.that(`B : ${infos.length} négociation(s), chacune sur SA piste (1), jamais celle de A (2)`,
    infos.length > 0 && infos.every((h) => h.query.get("AudioStreamIndex") === "1"), seen);
  b.checks.that("B : aucune négociation avec la position de A", infos.every((h) => !Number(h.query.get("StartTimeTicks") || 0)), seen);
  const streamsA = b.media.hits.filter((h) => h.at >= since && h.item !== itemB && h.kind !== "playbackinfo");
  b.checks.that("plus aucune requête de flux pour A après le passage à B (hors fin de l'ancien)", streamsA.filter((h) => h.at > since + 3_000).length === 0,
    streamsA.length);
}
