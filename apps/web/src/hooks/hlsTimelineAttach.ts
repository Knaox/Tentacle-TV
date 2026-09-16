import Hls from "hls.js";
import type { MutableRefObject } from "react";
import { wtLog } from "../watchTogether/wtLog";
import { decideHlsTimeline, HLS_CATCH_UP_MIN_S, HLS_RELOCATE_MAX, HLS_RELOCATE_MIN_S } from "./hlsTimeline";

/**
 * Le branchement de `hlsTimeline.ts` sur une instance hls.js : mesure de
 * l'atterrissage au premier fragment, puis replacement si la session est
 * partie trop loin. Séparé du module pur pour que celui-ci se teste sans
 * charger hls.js.
 */
export interface HlsTimelineRefs {
  /** À ajouter à une cible film pour viser en temps élément (= −atterrissage). */
  containerPtsOffsetRef: MutableRefObject<number>;
  /** À ajouter à `currentTime` pour obtenir la position film (= atterrissage). */
  effectiveOffsetRef: MutableRefObject<number>;
  offsetDetectedRef: MutableRefObject<boolean>;
  /** Base d'horodatage apprise sur ce média (session partie du segment 0). */
  ptsBaseRef: MutableRefObject<number | null>;
  /** Début de la passe ffmpeg de cette session (temps élément), null tant
   *  qu'aucun fragment n'est en tampon — lu par les sauts (`useSmartSeek`). */
  runStartRef: MutableRefObject<number | null>;
  /** Replacements déjà faits sur ce montage (garde contre une boucle). */
  relocationsRef: MutableRefObject<number>;
  /** Atterrissage appris, départ de la session suivante (cf. useVideoClock). */
  landingRef: MutableRefObject<number>;
}

/** Ce qu'il faut au replacement : le chemin de niveau 3 de `useSmartSeek`. */
export interface HlsRelocateHooks {
  seekTargetRef: MutableRefObject<number | null>;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  onSeekRequest?: (seconds: number) => void;
}

/**
 * Branche la mesure de l'atterrissage sur une instance hls.js, et le
 * replacement qui s'ensuit. `targetFilmS` : la position film que cette
 * session devait reprendre ; sans `onSeekRequest`, le lecteur ne sait pas
 * renégocier et la session reste telle quelle.
 */
export function attachHlsTimeline(
  hls: Hls,
  video: HTMLVideoElement,
  targetFilmS: number,
  refs: HlsTimelineRefs,
  hooks: HlsRelocateHooks,
): void {
  const relocate = hooks.onSeekRequest && ((filmS: number) => {
    // Même chemin qu'un saut de niveau 3 : la page apprend la position AVANT
    // la renégociation (la salle se fige là, pas dix secondes plus loin).
    hooks.onSeekComplete?.(filmS, video.paused);
    hooks.seekTargetRef.current = filmS;
    hooks.onSeekRequest?.(filmS);
  });
  let firstSn: number | null = null;
  let judged = false;
  hls.on(Hls.Events.INIT_PTS_FOUND, (_, data) => {
    if (String(data.id) !== "main" || firstSn !== null) return;
    firstSn = data.frag.sn;
    const decision = decideHlsTimeline({
      initPtsS: data.initPTS / data.timescale, firstFragmentSn: data.frag.sn, knownBaseS: refs.ptsBaseRef.current,
    });
    refs.ptsBaseRef.current = decision.baseS;
    refs.landingRef.current = decision.landingS;
    refs.containerPtsOffsetRef.current = -decision.landingS;
    refs.effectiveOffsetRef.current = decision.landingS;
    refs.offsetDetectedRef.current = true;
    wtLog("session", "hls.js : position film = currentTime + atterrissage", {
      reason: decision.reason, landingS: decision.landingS.toFixed(3), baseS: decision.baseS?.toFixed(3) ?? null,
      firstSn: data.frag.sn, playlistStartS: data.frag.start.toFixed(3),
    });
  });
  hls.on(Hls.Events.FRAG_BUFFERED, (_, data) => {
    if (judged || String(data.id) !== "main" || firstSn === null || data.frag.sn !== firstSn) return;
    judged = true;
    refs.runStartRef.current = data.frag.start;
    // En avance sur la cible : la session est partie trop loin. Une session
    // neuve repart au bon endroit — jamais un retour en arrière dans celle-ci.
    const landingS = refs.effectiveOffsetRef.current;
    const aheadS = video.currentTime + landingS - targetFilmS;
    // En retard (la marge de départ, cf. HLS_START_MARGIN_S) : on avance
    // jusqu'à la cible, dans la passe — un saut en avant ne relance rien.
    if (aheadS <= -HLS_CATCH_UP_MIN_S) {
      wtLog("session", "hls.js : partie en retard — avance jusqu'à la cible", { behindS: (-aheadS).toFixed(2) });
      video.currentTime = targetFilmS - landingS;
      return;
    }
    if (!relocate || aheadS < HLS_RELOCATE_MIN_S || refs.relocationsRef.current >= HLS_RELOCATE_MAX) return;
    refs.relocationsRef.current += 1;
    wtLog("session", "hls.js : session partie trop loin — session neuve à la cible", {
      aheadS: aheadS.toFixed(3), targetFilmS: targetFilmS.toFixed(2), relocations: refs.relocationsRef.current,
    });
    relocate(targetFilmS);
  });
}
