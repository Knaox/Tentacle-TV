import Hls, { type ErrorData } from "hls.js";
import { hlsFailure, type PlaybackFailure } from "@tentacle-tv/shared";

const DBG = "[Tentacle:VideoPlayer]";

/**
 * Les relances qu'une erreur FATALE de hls.js mérite encore — ses propres
 * réessais (`configHls` : fragments, manifeste) ont déjà eu lieu quand elle
 * arrive. Avant, on relançait sans compter : une panne de serveur tournait
 * en rond derrière un spinner, pour toujours. Les compteurs repartent de zéro
 * à chaque fragment de MÉDIA reçu : une coupure guérie ne compte plus.
 *
 * `reload` : un fragment ILLISIBLE (`fragParsingError`) accuse d'abord l'init,
 * que hls.js garde et que `recoverMediaError` ne redemande pas. Mesuré le
 * 11/11/2026 (Jellyfin 10.11, HLS en fMP4, reprise loin du début) : hls.js
 * demande l'init et le premier segment ENSEMBLE ; Jellyfin tue l'encodage parti
 * de 0 pour le relancer à la bonne position, l'init répond 500 (« A task was
 * canceled »), puis à la relance 200 avec un corps VIDE — et plus aucun
 * segment ne se lit. On recharge alors la source ENTIÈRE, un peu plus tard
 * (l'encodage relancé a écrit son init), deux fois au plus.
 */
export const HLS_MAX_RECOVERIES = { network: 1, media: 2, reload: 2 } as const;

/** L'attente avant de recharger la source (× le rang de l'essai) : le temps, pour le serveur, d'écrire son init. */
export const HLS_RELOAD_DELAY_MS = 1_000;

export type HlsRecoveryStep = "startLoad" | "recoverMedia" | "reload" | "fail";

/** La suite d'une erreur fatale, pure : relancer le chargement, réparer le décodage, recharger la source, ou le dire. */
export function hlsRecoveryStep(
  data: Pick<ErrorData, "type" | "details">,
  attempts: { network: number; media: number; reload?: number },
): HlsRecoveryStep {
  // Le manifeste ou la liste d'un palier : hls.js les a déjà redemandés, et
  // `startLoad` ne les recharge pas — relancer n'aboutirait à rien.
  if (/^(manifest|level)/i.test(String(data.details))) return "fail";
  if (data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR && (attempts.reload ?? 0) < HLS_MAX_RECOVERIES.reload) return "reload";
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
  const attempts = { network: 0, media: 0, reload: 0 };
  let failed = false;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  hls.on(Hls.Events.FRAG_BUFFERED, (_, data) => {
    // L'init « tamponné » ne prouve rien — c'est lui qui remettait les compteurs à zéro à chaque
    // tour, et un init vide faisait relancer SANS FIN, dix fois par seconde, sans jamais rien dire.
    if (data.frag.sn === "initSegment") return;
    attempts.network = 0;
    attempts.media = 0;
    attempts.reload = 0;
  });
  hls.on(Hls.Events.DESTROYING, () => {
    if (reloadTimer !== null) clearTimeout(reloadTimer);
    reloadTimer = null;
  });
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (!data.fatal || failed) return;
    console.error(DBG, "HLS fatal error:", data.type, data.details);
    if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR && hooks.onManifestRefused()) return;
    // Une recharge est déjà prévue : les erreurs qui suivent, du même init, n'ajoutent rien.
    if (reloadTimer !== null) return;
    const step = hlsRecoveryStep(data, attempts);
    if (step === "reload") {
      attempts.reload += 1;
      const url = hls.url;
      hls.stopLoad();
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        // La même adresse : la position de départ est celle de la configuration, ou celle déjà jouée.
        if (url) hls.loadSource(url);
      }, HLS_RELOAD_DELAY_MS * attempts.reload);
      return;
    }
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
