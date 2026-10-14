/**
 * Le flux RELAYÉ de la bande-annonce affichée (`/api/trailers/resolve`), demandé
 * à chaque changement de vidéo ; la précédente demande est abandonnée. Sans
 * cache à part : le serveur garde la vidéo résolue (~6 h pour YouTube) — la
 * relancer ne lui coûte aucune extraction.
 */

import { useEffect, useState } from "react";
import { fetchTrailerResolve, type TrailerResolveResult } from "@tentacle-tv/api-client";
import { trailerItemKey, type RelayedTrailerPlayback } from "@tentacle-tv/shared";
import { backendAbsoluteUrl } from "../../trailerPreview/previewStream";

export type TrailerResolveState = { key: string; result: TrailerResolveResult | null };

export function useTrailerResolve(playback: RelayedTrailerPlayback | null): TrailerResolveResult | null {
  const key = playback ? trailerItemKey(playback) : "";
  const [state, setState] = useState<TrailerResolveState>({ key: "", result: null });

  useEffect(() => {
    if (!playback) return;
    const controller = new AbortController();
    setState({ key, result: null });
    fetchTrailerResolve(playback, backendAbsoluteUrl(""), controller.signal)
      .then((result) => setState({ key, result }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, result: { status: "failed" } });
      });
    return () => controller.abort();
    // `key` dit tout de la vidéo : une file reconstruite à l'identique ne relance rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state.result : null;
}
