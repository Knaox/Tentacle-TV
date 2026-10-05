/**
 * Le banc des pannes vu par le VRAI lecteur web (depuis apps/backend) :
 *
 *   pnpm bench:jellyfin-outage:web        (--keep : garde la base ; --run-dir <dossier>)
 *
 * La vraie app web (Vite, proxy /api vers le vrai backend) dans Chrome sans
 * tête, une vraie lecture (fichier direct, puis HLS avec la piste audio 2),
 * et le faux Jellyfin qui tombe et revient comme Jellyfin 10.11.11 : chaque
 * délai mesuré depuis la page (`webScenarios.ts`). Le bureau partage cette UI
 * et cet entonnoir ; seul son moteur (mpv) n'est pas joué ici.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Checks } from "../notif-e2e/checks";
import { BACKEND_DIR } from "../notif-e2e/benchEnv";
import { Chrome } from "./chrome";
import { sleep, type FakeUser } from "./fakeJellyfin";
import { FakeMedia, ITEM_B, ITEM_ID } from "./fakeMedia";
import { startStack } from "./stack";
import { PROBE, checkReopenedTranscode, nextEpisode, playThrough, waitChannel, waitPlaying, type WebBench } from "./webScenarios";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const runDirArg = args[args.indexOf("--run-dir") + 1];
const runDir = args.includes("--run-dir") && runDirArg ? runDirArg : join(tmpdir(), `tentacle-panne-web-${Date.now()}`);
const WEB_DIR = resolve(BACKEND_DIR, "../web");
const VITE_PORT = 5196;
const USER: FakeUser = { Id: "0000000000000000000000000000000a", Name: "web", token: "jeton-web" };

async function startVite(backendUrl: string): Promise<ChildProcess> {
  const viteBin = join(dirname(require.resolve("vite/package.json", { paths: [WEB_DIR] })), "bin/vite.js");
  const vite = spawn(process.execPath, [viteBin, "--port", String(VITE_PORT), "--host", "127.0.0.1", "--strictPort"], {
    cwd: WEB_DIR, env: { ...process.env, TENTACLE_DEV_API: backendUrl }, stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${VITE_PORT}/`)).ok) return vite;
    } catch { /* pas encore */ }
    await sleep(500);
  }
  throw new Error("Vite ne répond pas");
}

async function openPlayer(chrome: Chrome): Promise<void> {
  await chrome.navigate(`http://127.0.0.1:${VITE_PORT}/watch/${ITEM_ID}`);
  await waitPlaying(chrome, 4, 60_000);
  // Une panne avant que le canal de la page ne soit annoncé ne lui serait pas dite : on l'attend.
  await waitChannel(chrome, 20_000);
}

async function main(): Promise<number> {
  mkdirSync(runDir, { recursive: true });
  const log = (line: string): void => console.log(`[panne-web] ${line}`);
  const media = new FakeMedia(join(tmpdir(), "tentacle-panne-media"));
  media.prepare();
  const stack = await startStack({
    users: [USER], runDir, fakePort: 18296, backendPort: 3296, db: { name: "tentacle-panne-web-db", port: 18299 }, keep, log,
    // Tout passe par le proxy du backend : le faux Jellyfin n'a pas de CORS.
    config: { direct_streaming_enabled: "false" },
  }, (fake) => media.install(fake));
  const chrome = new Chrome();
  const checks = new Checks();
  const bench: WebBench = { chrome, fake: stack.fake, media, checks, measures: {}, traces: {} };
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  let vite: ChildProcess | null = null;
  try {
    vite = await startVite(stack.backend.url);
    await chrome.start(9351);
    await chrome.send("Network.enable");
    await chrome.send("Network.setCookie", { name: "tentacle_token", value: USER.token, domain: "127.0.0.1", path: "/" });
    await chrome.send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
    await chrome.navigate(`http://127.0.0.1:${VITE_PORT}/`);
    await chrome.evaluate(`localStorage.setItem("tentacle_user", ${JSON.stringify(JSON.stringify({ Id: USER.Id, Name: USER.Name, Policy: { IsAdministrator: false } }))}); return true;`);

    checks.begin("Lecteur web — mise en place");
    media.mode = "direct";
    if (only === "hls") media.mode = "transcode";
    await openPlayer(chrome);
    if (only !== "hls" && only !== "episode") {
    checks.that("lecture directe en cours (fichier statique)", media.hits.some((h) => h.kind === "static"));
    await playThrough(bench, "webDirect", "lecture directe, docker stop 20 s puis start", async () => {
      await stack.fake.dockerStop();
      await sleep(20_000);
      await stack.fake.dockerStart();
    }, ["shutting-down", "down", "starting"]);
    await openPlayer(chrome);
    await playThrough(bench, "webDirectRestart", "lecture directe, docker restart", () => stack.fake.dockerRestart(), ["shutting-down", "starting"]);
    }
    if (only !== "direct" && only !== "episode") {

    media.mode = "transcode";
    media.defaultAudio = 2;
    await openPlayer(chrome);
    checks.that("lecture transcodée (HLS) en cours, piste audio 2", media.hits.some((h) => h.kind === "segment" && h.query.get("AudioStreamIndex") === "2"));
    const tRestart = Date.now();
    await playThrough(bench, "webHlsRestart", "HLS, redémarrage par l'API", () => stack.fake.apiRestart(), ["restarting", "starting"]);
    checkReopenedTranscode(bench, tRestart, "2");

    const tStop = Date.now();
    await playThrough(bench, "webHlsStop", "HLS, docker stop 25 s puis start", async () => {
      await stack.fake.dockerStop();
      await sleep(25_000);
      await stack.fake.dockerStart();
    }, ["shutting-down", "down", "starting"]);
    checkReopenedTranscode(bench, tStop, "2");
    }
    if (only === "episode") {
      media.mode = "transcode";
      media.defaultAudio = 2;
      await openPlayer(chrome);
      // Une position de reprise non nulle pour A (comme après une relance) : de quoi voir une fuite.
      await playThrough(bench, "episodeOutage", "A, redémarrage par l'API", () => stack.fake.apiRestart(), ["restarting", "starting"]);
    }
    await nextEpisode(bench, ITEM_B);
  } catch (err) {
    checks.that("le banc web a tourné jusqu'au bout", false, err instanceof Error ? err.message : String(err));
  } finally {
    // Une source modifiée pendant le passage : Vite recharge l'app à chaud, la
    // vidéo disparaît — les mesures ne valent plus rien. On le dit, sans accuser le lecteur.
    const hmr = chrome.console.filter((line) => line.text.includes("[vite] hot updated")).length;
    checks.that("aucun rechargement à chaud pendant le passage (sinon : rejouer sans toucher aux sources)", hmr === 0, hmr);
    writeFileSync(join(runDir, "console.json"), JSON.stringify(chrome.console, null, 2));
    writeFileSync(join(runDir, "traces.json"), JSON.stringify(bench.traces));
    await chrome.stop();
    vite?.kill("SIGTERM");
    await stack.stop();
  }
  writeFileSync(join(runDir, "rapport-web.json"), JSON.stringify({ at: new Date().toISOString(), measures: bench.measures, results: checks.results }, null, 2));
  for (const [k, v] of Object.entries(bench.measures)) if (typeof v === "string") console.log(`  · ${k} : ${v}`);
  const failed = checks.results.filter((r) => !r.ok);
  console.log(`\n${checks.results.length - failed.length}/${checks.results.length} vérifications réussies — rapport : ${join(runDir, "rapport-web.json")}`);
  return failed.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (err) => {
  console.error(err);
  process.exit(1);
});
