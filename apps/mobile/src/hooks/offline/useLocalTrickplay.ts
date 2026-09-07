import { useMemo } from "react";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import { metaUri } from "@/offline/engineApi";
import { useLocalSnapshotJson } from "./useLocalSnapshot";

/** Le résumé écrit par le moteur dans `meta/<id>/trickplay.json`. */
interface LocalTrickplayFile {
  mediaSourceId: string;
  width: number;
  info: TrickplayInfo;
}

export interface LocalTrickplay {
  mediaSourceId: string;
  width: number;
  info: TrickplayInfo;
  /** L'URI `file://` d'une planche. */
  tileUri: (tileIndex: number) => string;
}

/**
 * Les planches trickplay gardées avec le titre : le même composant d'aperçu,
 * la planche lue sur l'appareil. `null` sans résumé local (pas de planches
 * côté serveur, ou snapshot ancien) — le lecteur retombe sur rien, jamais sur
 * le réseau.
 */
export function useLocalTrickplay(itemId: string | undefined): LocalTrickplay | null {
  const { data } = useLocalSnapshotJson<LocalTrickplayFile>(itemId, "trickplay.json");
  return useMemo(() => {
    if (!data || itemId === undefined || typeof data.width !== "number" || !data.info) return null;
    const width = data.width;
    return {
      mediaSourceId: data.mediaSourceId,
      width,
      info: data.info,
      tileUri: (tileIndex: number) => metaUri(itemId, `trickplay/${width}/${tileIndex}.jpg`),
    };
  }, [data, itemId]);
}
