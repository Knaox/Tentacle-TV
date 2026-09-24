import { useCallback, useMemo, useState } from "react";
import { itemTrackChoiceFromStreams } from "@tentacle-tv/shared";
import { useUserId } from "@tentacle-tv/api-client";
import { formatTrackLabel } from "@/lib/playerUtils";
import { useRememberLocalTracks } from "./offline/useRememberLocalTracks";
import type { usePlayerPlayback } from "./usePlayerPlayback";

/**
 * Les pistes du lecteur en ligne — extraites de `PlayerScreen` (limite de 300
 * lignes) : les listes des menus, et les choix EXPLICITES, mémorisés pour ce
 * contenu (miroir local, puis serveur) — des langues, jamais des index. La
 * résolution automatique des préférences ne compte pas comme un choix.
 */
export function usePlayerTracks(itemId: string, pb: ReturnType<typeof usePlayerPlayback>) {
  const userId = useUserId();
  const [trackOverride, setTrackOverride] = useState(false);
  const { changeAudio, changeSubtitle } = pb;
  const handleSelectAudio = useCallback((idx: number) => { setTrackOverride(true); changeAudio(idx); }, [changeAudio]);
  const handleSelectSubtitle = useCallback((idx: number) => { setTrackOverride(true); changeSubtitle(idx); }, [changeSubtitle]);
  const trackChoice = useMemo(
    () => (trackOverride ? itemTrackChoiceFromStreams(pb.streams, pb.audioIndex, pb.subtitleIndex) : null),
    [trackOverride, pb.streams, pb.audioIndex, pb.subtitleIndex],
  );
  useRememberLocalTracks({ userId, itemId, choice: trackChoice });

  // Les listes des menus audio / sous-titres.
  const audioTracks = useMemo(() =>
    pb.streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [pb.streams],
  );
  const subtitleTracks = useMemo(() =>
    pb.streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [pb.streams],
  );

  return { handleSelectAudio, handleSelectSubtitle, audioTracks, subtitleTracks };
}
