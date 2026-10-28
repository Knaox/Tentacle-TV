/**
 * Le banc du moteur audio NATIF — sous Node, la vraie libmpv par koffi, sans
 * Electron ni fenêtre (rien ne vole le focus ; aucun verrou Electron requis).
 *
 *   TENTACLE_MPV_LIB=livree pnpm --filter @tentacle-tv/desktop-electron bench:audio [scénarios…]
 *
 * Scénarios : gapless, swapCurrent, swapNext, provisionalEnd, growingFast,
 * growingSlow, writerStall, formats (sortie
 * PCM, mesurés à l'échantillon) ; gaplessRealtime, swapRealtime, heldRealtime,
 * latency, ram, exclusive, outputs (vraie
 * sortie CoreAudio, volume quasi nul) ; cutRealtime (URL directe coupée en
 * milieu de titre, sortie `null` cadencée) ; jfGaplessPcm, jfGaplessRealtime, jfLatency,
 * jfFormats, jfReplayGain (le Jellyfin du banc Octave). Sans argument : tous
 * sauf ceux du Jellyfin.
 * `BENCH_DIR` : dossier des fichiers témoins (défaut : un dossier temporaire).
 */

import path from "node:path";
import { benchDir, generate } from "./fixtures.mjs";
import { startBenchServer } from "./serve.mjs";
import { PORT } from "./benchKit.mts";
import { formats, gapless, growingHold, provisionalEnd, swapCurrent, swapNext, writerStall } from "./pcmScenarios.mts";
import { exclusive, latency, outputs, ram } from "./deviceScenarios.mts";
import { gaplessRealtime, heldRealtime, swapRealtime } from "./realtimeScenarios.mts";
import { jfFormats, jfGaplessPcm, jfGaplessRealtime, jfLatency, jfReplayGain } from "./jellyfinScenarios.mts";
import { firstClick, jfClicks } from "./clickScenarios.mts";
import { cutRealtime } from "./cutScenarios.mts";

const fx = generate(benchDir("audio"));
// `BENCH_NO_SERVER=1` : le port est pris par un vrai backend (scénarios du Jellyfin seulement).
const server = process.env["BENCH_NO_SERVER"] === "1" ? { requests: [], close: () => undefined } : await startBenchServer(fx, PORT);
const out = (name: string): string => path.join(fx, `out-${name}.raw`);

const all: Record<string, () => Promise<unknown>> = {
  gapless: () => gapless(fx, out("gapless")),
  swapCurrent: () => swapCurrent(fx, out("swap-current")),
  swapNext: () => swapNext(fx, out("swap-next")),
  provisionalEnd: () => provisionalEnd(fx, out("provisional")),
  growingFast: () => growingHold(fx, out("grow-fast"), 1.9),
  growingSlow: () => growingHold(fx, out("grow-slow"), 0.7),
  writerStall: () => writerStall(fx, out("writer-stall")),
  formats: () => formats(fx, fx),
  gaplessRealtime: () => gaplessRealtime(),
  swapRealtime: () => swapRealtime(),
  heldRealtime: () => heldRealtime(),
  latency: () => latency(server.requests),
  ram: () => ram(),
  exclusive: () => exclusive(),
  outputs: () => outputs(),
  // Le Jellyfin du banc Octave (port 8196) : à demander explicitement.
  jfGaplessPcm: () => jfGaplessPcm(fx),
  jfGaplessRealtime: () => jfGaplessRealtime(),
  jfLatency: () => jfLatency(),
  jfFormats: () => jfFormats(fx),
  jfReplayGain: () => jfReplayGain(fx),
  jfClicks: () => jfClicks(Number(process.env["CLICKS"] ?? 20)),
  jfFirstClick: () => firstClick(),
  // S5 : une URL directe coupée en milieu de titre (sortie `null`, cadencée et muette).
  cutRealtime: () => cutRealtime(fx),
};
const DEFAULT = Object.keys(all).filter((k) => !k.startsWith("jf"));

const wanted = process.argv.slice(2).filter((a) => a in all);
const report: Record<string, unknown> = {};
for (const name of wanted.length > 0 ? wanted : DEFAULT) {
  try {
    report[name] = await (all[name] as () => Promise<unknown>)();
  } catch (error) {
    report[name] = { error: String(error) };
  }
  console.log(`\n## ${name}\n${JSON.stringify(report[name], null, 1)}`);
}
server.close();
process.exit(0);
