import type { SegmentSetupRun } from "@tentacle-tv/shared";
import { readSegmentRun } from "../segmentPlugins/segmentRunModel";
import { setupApi } from "./setupApi";

/**
 * La détection des passages pendant l'installation : lancée, puis suivie
 * jusqu'au bout (le redémarrage de Jellyfin prend jusqu'à une minute). Elle
 * n'arrête JAMAIS l'assistant : un échec rend `null`, l'écran le dit en mots
 * simples et l'installation continue.
 */

const POLL_MS = 1500;
/** Au-delà, on n'attend plus : le serveur finit seul, l'administration le montrera. */
const GIVE_UP_MS = 5 * 60_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSegmentSetup(onProgress: (run: SegmentSetupRun) => void): Promise<SegmentSetupRun | null> {
  try {
    let run = readSegmentRun(await setupApi.startSegments());
    const started = Date.now();
    while (run && (run.running || !run.finishedAt) && Date.now() - started < GIVE_UP_MS) {
      onProgress(run);
      await wait(POLL_MS);
      // Jellyfin redémarre : une sonde ratée n'est pas un échec, on relit.
      run = readSegmentRun(await setupApi.segmentsStatus().catch(() => null)) ?? run;
    }
    if (run && !run.running) onProgress(run);
    return run && !run.running ? run : null;
  } catch {
    return null;
  }
}
