/**
 * La préparation tenue par le serveur, câblée : UN registre pour le processus,
 * son balayage, le lancement d'une préparation auprès de Jellyfin et la push
 * silencieuse « prêt ». Les routes (`routes/downloadsPrepared.ts`) n'ont plus
 * qu'à demander.
 *
 * La push ne part que si PERSONNE ne lit la préparation quand elle s'achève :
 * un téléphone qui la suit en a vu la fin lui-même. Celui dont le transfert a
 * été coupé, lui, dort peut-être — c'est lui qu'il faut réveiller (iOS), pour
 * qu'il reprenne par plage d'octets un fichier désormais complet.
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_ROOT } from "../dataDir";
import { mediaBrowserAuthHeader } from "../jellyfinPolicy";
import { sendSilentToUser } from "../pushService";
import { lightStreamParams, type LightRequest } from "./lightStream";
import type { PrepareJob } from "./prepareJob";
import { PrepareRegistry } from "./prepareRegistry";
import { runPreparation } from "./prepareRunner";

/** Le type de la push silencieuse, lu par le mobile (`offlinePreparedPush.ts`). Ne se renomme pas. */
export const PREPARED_PUSH_TYPE = "offline:prepared";

const SWEEP_EVERY_MS = 10 * 60 * 1000;

export const prepareRegistry = new PrepareRegistry(join(DATA_ROOT, "offline-prepare"), () => Date.now());

let sweeper: ReturnType<typeof setInterval> | null = null;

function armSweep(): void {
  if (sweeper !== null) return;
  sweeper = setInterval(() => prepareRegistry.sweep(), SWEEP_EVERY_MS);
  sweeper.unref();
}

function announceReady(job: PrepareJob): void {
  if (job.readers > 0 || job.released) return;
  void sendSilentToUser(job.userId, { type: PREPARED_PUSH_TYPE, itemId: job.itemId }).catch(() => undefined);
}

/** La préparation de cette demande, lancée si elle n'existe pas encore. */
export function acquirePreparation(
  key: string,
  userId: string,
  request: LightRequest,
  token: string,
  jellyfinUrl: string,
): PrepareJob {
  armSweep();
  return prepareRegistry.acquire(key, userId, request.itemId, (job) => {
    // Une session de transcodage À NOUS : aucun téléphone ne l'arrête en se
    // déconnectant, seul l'abandon de la préparation la coupe.
    const playSessionId = randomUUID();
    const params = lightStreamParams(request, { playSessionId, deviceId: `tentacle-dl-${playSessionId.slice(0, 8)}` });
    console.log(`[offline-prepare] démarrée : ${request.itemId} (${request.presetId})`);
    void runPreparation(
      job,
      (signal) =>
        fetch(`${jellyfinUrl}/Videos/${request.itemId}/stream.mp4?${params.toString()}`, {
          headers: { Authorization: mediaBrowserAuthHeader(token) },
          signal,
        }),
      () => Date.now(),
      announceReady,
    );
  });
}
