/**
 * Les pannes jouées par le banc, et ce que chacune doit produire — chaque
 * délai MESURÉ, comparé à son seuil, noté.
 *
 * Seuils (passation du 2026-10-05) : le lecteur apprend la panne en moins de
 * 10 s (on vise la seconde quand Jellyfin l'annonce) ; il apprend le retour
 * vite assez pour rouvrir son flux en moins de 15 s ; une socket fermée alors
 * que Jellyfin répond ne dit RIEN.
 */

import { API_KEY, sleep, type FakeJellyfin } from "./fakeJellyfin";
import type { FakePlayer } from "./players";
import type { RealClient } from "./realClient";
import type { Checks } from "../notif-e2e/checks";

export interface Bench {
  fake: FakeJellyfin;
  players: FakePlayer[];
  client: RealClient;
  checks: Checks;
  backendUrl: string;
  /** Les mesures, pour le rapport JSON. */
  measures: Record<string, number | string | null>;
}

const ms = (value: number | null): string => (value === null ? "jamais" : `${value} ms`);

/** Le délai entre `t0` et le premier état `state` reçu par chaque lecteur (le pire). */
function worstDelay(bench: Bench, t0: number, state: string): number | null {
  let worst = 0;
  for (const p of bench.players) {
    const hit = p.jellyfinStates(t0).find((s) => s.state === state);
    if (!hit) return null;
    worst = Math.max(worst, hit.at - t0);
  }
  return worst;
}

function within(bench: Bench, key: string, label: string, value: number | null, max: number): void {
  bench.measures[key] = value;
  bench.checks.that(`${label} : ${ms(value)} (seuil ${max} ms)`, value !== null && value <= max, value);
}

/** Après le retour : la socket du serveur, les connexions d'appareils, les reports, la nouvelle session. */
async function checkRecovery(bench: Bench, key: string, t0: number): Promise<void> {
  const { fake, checks } = bench;
  await waitUntil(() => fake.upSince > t0, 60_000);
  const up = fake.upSince;
  await sleep(4_000);
  within(bench, `${key}.upNotice`, "« up » reçu par chaque lecteur après le vrai retour", worstDelay(bench, up, "up"), 2_500);
  const premature = bench.players.some((p) => p.jellyfinStates(t0).some((s) => s.state === "up" && s.at < up));
  checks.that("aucun « up » annoncé avant le vrai retour (200 transitoire ignoré)", !premature);
  const serverSocket = fake.socketsOpened.find((o) => o.at >= up && o.token === API_KEY);
  within(bench, `${key}.serverSocket`, "socket du serveur rouverte", serverSocket ? serverSocket.at - up : null, 1_500);
  let worstDevice = 0;
  let worstResync = 0;
  let worstNewSession = 0;
  let missing = "";
  for (const p of bench.players) {
    const device = fake.socketsOpened.find((o) => o.at >= up && o.token === p.token);
    const resync = fake.hitsSince(up, "/Sessions/Playing/Progress", p.token)[0];
    const fresh = fake.hitsSince(up, undefined, p.token).find((h) => h.path.startsWith("/Sessions/Playing") && h.body?.PlaySessionId === p.playSessionId);
    if (!device || !resync || !fresh) missing += `${p.name}${!device ? " socket" : ""}${!resync ? " resync" : ""}${!fresh ? " session" : ""}; `;
    if (device) worstDevice = Math.max(worstDevice, device.at - up);
    if (resync) worstResync = Math.max(worstResync, resync.at - up);
    if (fresh) worstNewSession = Math.max(worstNewSession, fresh.at - up);
  }
  checks.that("chaque lecteur : connexion d'appareil, report et nouvelle session revus", missing === "", missing);
  within(bench, `${key}.deviceSockets`, "connexions d'appareils rouvertes (la pire)", missing ? null : worstDevice, 2_500);
  within(bench, `${key}.resync`, "lectures redites à Jellyfin (la pire)", missing ? null : worstResync, 3_000);
  within(bench, `${key}.newSession`, "nouvelle session de lecture chez Jellyfin (la pire)", missing ? null : worstNewSession, 3_000);
  const stoppedOld = bench.players.every((p) => fake.hitsSince(up, "/Sessions/Playing/Stopped", p.token).length > 0);
  checks.that("l'ancienne session est close chez Jellyfin (position gardée)", stoppedOld);
}

export async function socketBlip(bench: Bench): Promise<void> {
  bench.checks.begin("Socket coupée, Jellyfin répond : aucun message");
  const t0 = Date.now();
  bench.fake.socketBlip();
  await sleep(10_000);
  const said = bench.players.flatMap((p) => p.jellyfinStates(t0));
  bench.checks.that("aucun server:jellyfin pendant 10 s", said.length === 0, said);
  const back = bench.fake.socketsOpened.find((o) => o.at >= t0 && o.token === API_KEY);
  within(bench, "blip.serverSocket", "socket du serveur rouverte d'elle-même", back ? back.at - t0 : null, 2_500);
  bench.checks.that("aucune phase de panne côté client réel", bench.client.phases(t0).every((p) => p.phase === "none"), bench.client.phases(t0));
}

export async function apiRestart(bench: Bench): Promise<void> {
  bench.checks.begin("Redémarrage par l'API (ServerRestarting, 0,7 s fermé, 6,6 s de chargement)");
  const t0 = Date.now();
  void bench.fake.apiRestart();
  await sleep(1_500);
  within(bench, "apiRestart.notice", "« redémarre » reçu par chaque lecteur", worstDelay(bench, t0, "restarting"), 1_000);
  await checkRecovery(bench, "apiRestart", t0);
  sequence(bench, t0, ["restarting", "starting", "up"]);
}

export async function dockerRestart(bench: Bench): Promise<void> {
  bench.checks.begin("docker restart (ShuttingDown, 1,3 s fermé, 200 transitoire, 5 s de chargement)");
  const t0 = Date.now();
  void bench.fake.dockerRestart();
  await sleep(1_500);
  within(bench, "dockerRestart.notice", "« s'arrête » reçu par chaque lecteur", worstDelay(bench, t0, "shutting-down"), 1_000);
  await checkRecovery(bench, "dockerRestart", t0);
  within(bench, "dockerRestart.starting", "« démarre » (= redémarre) reçu", worstDelay(bench, t0, "starting"), 10_000);
}

export async function dockerStop(bench: Bench, joiner: FakePlayer, stranger: FakePlayer): Promise<void> {
  bench.checks.begin("docker stop puis docker start 20 s plus tard");
  const t0 = Date.now();
  await bench.fake.dockerStop();
  await sleep(5_000);
  within(bench, "dockerStop.down", "« arrêté » reçu par chaque lecteur", worstDelay(bench, t0, "down"), 4_000);
  const health = (await (await fetch(`${bench.backendUrl}/api/health`)).json()) as { jellyfin?: { state?: string } };
  bench.checks.that("/api/health dit « down » pendant la panne", health.jellyfin?.state === "down", health.jellyfin);
  // Un lecteur dont la socket se rouvre en pleine panne (jeton déjà connu) l'apprend après session:ready.
  const tJoin = Date.now();
  await joiner.connect();
  const after = joiner.received.filter((r) => r.at >= tJoin).map((r) => r.msg);
  const order = after.map((m) => (m.type === "server:jellyfin" ? `server:jellyfin=${m.state}` : m.type));
  bench.checks.that("socket rouverte pendant la panne : session:ready puis « down »", order.join(",") === "auth_ok,session:ready,server:jellyfin=down", order);
  // Un jeton jamais vu ne peut pas être jugé sans Jellyfin : refusé, mais le lecteur sait pourquoi.
  await stranger.connect().catch(() => undefined);
  const strangerSaw = stranger.received.map((r) => (r.msg.type === "server:jellyfin" ? `server:jellyfin=${r.msg.state}` : `${r.msg.type}${r.msg.reason ? `=${String(r.msg.reason)}` : ""}`));
  bench.checks.that("jeton inconnu pendant la panne : l'état, puis le refus « server_unreachable »", strangerSaw.join(",") === "server:jellyfin=down,auth_error=server_unreachable", strangerSaw);
  await sleep(15_000);
  const tStart = Date.now();
  void bench.fake.dockerStart();
  await checkRecovery(bench, "dockerStop", tStart);
  sequence(bench, t0, ["shutting-down", "down", "starting", "up"]);
}

export async function dockerKill(bench: Bench): Promise<void> {
  bench.checks.begin("docker kill (rien d'annoncé, 1006), puis docker start 6 s plus tard");
  const t0 = Date.now();
  await bench.fake.dockerKill();
  await sleep(6_000);
  within(bench, "dockerKill.down", "« arrêté » reçu sans annonce", worstDelay(bench, t0, "down"), 4_500);
  const tStart = Date.now();
  void bench.fake.dockerStart();
  await checkRecovery(bench, "dockerKill", tStart);
  sequence(bench, t0, ["down", "starting", "up"]);
}

/** La suite d'états vue par chaque lecteur, et par la règle du vrai client. */
function sequence(bench: Bench, t0: number, expected: string[]): void {
  for (const p of bench.players) {
    const seen = p.jellyfinStates(t0).map((s) => s.state);
    bench.checks.that(`${p.name} : ${expected.join(" → ")}`, JSON.stringify(seen) === JSON.stringify(expected), seen);
  }
  const phases = bench.client.phases(t0);
  const states = phases.map((p) => p.state);
  const recovered = phases.at(-1);
  bench.checks.that(`client réel (api-client) : ${expected.join(" → ")}, une reprise`, JSON.stringify(states) === JSON.stringify(expected) && recovered?.phase === "recovering", phases);
}

async function waitUntil(test: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!test()) {
    if (Date.now() > deadline) throw new Error("délai dépassé");
    await sleep(50);
  }
}
