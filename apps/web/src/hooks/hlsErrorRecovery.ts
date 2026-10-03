import Hls, { type ErrorData } from "hls.js";
import { hlsFailure, type PlaybackFailure } from "@tentacle-tv/shared";

const DBG = "[Tentacle:VideoPlayer]";

/**
 * Les relances qu'une erreur FATALE de hls.js mérite encore — ses propres
 * réessais (`configHls` : fragments, manifeste) ont déjà eu lieu quand elle
 * arrive. Avant, on relançait sans compter : une panne de serveur tournait
 * en rond derrière un spinner, pour toujours. Les compteurs repartent de zéro
 * à chaque fragment reçu : une coupure guérie ne compte plus.
 */
export const HLS_MAX_RECOVERIES = { network: 1, media: 2 } as const;

export type HlsRecoveryStep = "startLoad" | "recoverMedia" | "fail";

/** La suite d'une erreur fatale, pure : relancer le chargement, réparer le décodage, ou le dire. */
export function hlsRecoveryStep(
  data: Pick<ErrorData, "type" | "details">,
  attempts: { network: number; media: number },
): HlsRecoveryStep {
  // Le manifeste ou la liste d'un palier : hls.js les a déjà redemandés, et
  // `startLoad` ne les recharge pas — relancer n'aboutirait à rien.
  if (/^(manifest|level)/i.test(String(data.details))) return "fail";
  if (data.type === Hls.ErrorTypes.NETWORK_ERROR && attempts.network < HLS_MAX_RECOVERIES.network) return "startLoad";
  if (data.type === Hls.ErrorTypes.MEDIA_ERROR && attempts.media < HLS_MAX_RECOVERIES.media) return "recoverMedia";
  return "fail";
}

export interface HlsErrorHooks {
  /** Le manifeste direct refusé (CORS) : vrai si l'appelant a pris la relève (repli par le proxy). */
  onManifestRefused: () => boolean;
  /** Plus rien à tenter : l'échec, dans la forme commune. */
  onFail: (failure: PlaybackFailure) => void;
}

/** Les erreurs de hls.js, suivies : relances bornées, puis l'échec dit une fois. */
export function watchHlsErrors(hls: Hls, hooks: HlsErrorHooks): void {
  const attempts = { network: 0, media: 0 };
  let failed = false;
  hls.on(Hls.Events.FRAG_BUFFERED, () => {
    attempts.network = 0;
    attempts.media = 0;
  });
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (!data.fatal || failed) return;
    console.error(DBG, "HLS fatal error:", data.type, data.details);
    if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR && hooks.onManifestRefused()) return;
    const step = hlsRecoveryStep(data, attempts);
    if (step === "startLoad") {
      attempts.network += 1;
      hls.startLoad();
      return;
    }
    if (step === "recoverMedia") {
      attempts.media += 1;
      // Deuxième tentative : la recette de hls.js — changer de codec audio, puis réparer.
      if (attempts.media === HLS_MAX_RECOVERIES.media) hls.swapAudioCodec();
      hls.recoverMediaError();
      return;
    }
    failed = true;
    hooks.onFail({
      from: "engine",
      failure: hlsFailure({
        type: data.type,
        details: data.details,
        response: data.response ? { code: data.response.code, text: data.response.text } : undefined,
        reason: data.reason,
        error: data.error ? { message: data.error.message } : undefined,
      }),
    });
  });
}
