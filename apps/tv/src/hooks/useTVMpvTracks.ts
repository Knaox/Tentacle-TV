import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { MPVPlayerHandle, MpvTrack } from "../components/player/MPVPlayer";

/**
 * Encapsule la gestion des pistes MPV/Exo côté direct play :
 *  - Mapping Jellyfin index → MPV track ID via `handleTracks`
 *  - Application réactive de la sélection audio courante
 *
 * Mapping SOUS-TITRES (ExoPlayer) — deux familles de pistes natives :
 *  1) Side-loadées (VTT/ASS Jellyfin) : `nativeId` = "jf:<jellyfinIndex>"
 *     (SubtitleConfiguration.setId, propagé dans Format.id) → clé FIABLE.
 *  2) Embarquées dans le conteneur (texte interne + image PGS/DVB/VobSub) :
 *     Format.id nu (numéro de piste Matroska) → zip ORDONNÉ avec les subs
 *     Jellyfin INTERNES (IsExternal ≠ true), même ordre conteneur des deux
 *     côtés. Ne comble que les trous : pour le texte interne, la copie
 *     side-loadée (1) reste prioritaire. Donne un id natif aux pistes IMAGE
 *     embarquées → sélection PGS native SANS transcodage (useTVSubtitleControl).
 *     Zip UNIQUEMENT en direct play : en transcode (HLS), les pistes exposées
 *     par le flux n'ont plus rien à voir avec celles du conteneur d'origine.
 *
 * L'ancien mapping « N dernières pistes » comptait les subs IMAGE (exclues du
 * sideload) et ignorait les pistes embarquées → décalage → mauvaise piste
 * sélectionnée (« VFF forced » affichait de l'anglais).
 *
 * Inerte pendant un transcode (le serveur gère la sélection via l'URL HLS).
 */
export function useTVMpvTracks(args: {
  playerRef: React.RefObject<MPVPlayerHandle | null>;
  streams: JfStream[];
  audioIndex: number;
  subtitleIndex: number;
  isDirectPlay: boolean;
  itemId?: string;
  mediaSourceId?: string;
}) {
  const { playerRef, streams, audioIndex, isDirectPlay } = args;
  const [mpvTrackMap, setMpvTrackMap] = useState<Record<number, number>>({});
  // jellyfinIndex (sous-titre) → id de piste native ExoPlayer
  const [subtitleTrackMap, setSubtitleTrackMap] = useState<Record<number, number>>({});
  const externalSubsLoaded = useRef(false);

  const handleTracks = useCallback((tracks: MpvTrack[]) => {
    const audioTracks = tracks.filter((t) => t.type === "audio");
    const subTracks = tracks.filter((t) => t.type === "sub");
    const jellyfinAudio = streams.filter((s) => s.Type === "Audio");
    const jellyfinSubs = streams.filter((s) => s.Type === "Subtitle");
    const map: Record<number, number> = {};
    jellyfinAudio.forEach((s, i) => { if (i < audioTracks.length) map[s.Index] = audioTracks[i].id; });
    jellyfinSubs.forEach((s, i) => { if (i < subTracks.length) map[s.Index] = subTracks[i].id; });
    setMpvTrackMap(map);

    const sub: Record<number, number> = {};
    const embedded: MpvTrack[] = [];
    for (const t of subTracks) {
      const m = /^jf:(\d+)$/.exec(t.nativeId ?? "");
      if (m) sub[Number(m[1])] = t.id;
      else embedded.push(t);
    }
    if (isDirectPlay) {
      const internalSubs = jellyfinSubs.filter((s) => !s.IsExternal);
      internalSubs.forEach((s, i) => {
        if (i < embedded.length && sub[s.Index] == null) sub[s.Index] = embedded[i].id;
      });
    }
    setSubtitleTrackMap(sub);
  }, [streams, isDirectPlay]);

  // Applique la piste audio via MPV en direct play (changement de track natif sans rebuilder l'URL)
  useEffect(() => {
    if (!isDirectPlay) return;
    const mpvId = mpvTrackMap[audioIndex];
    if (mpvId != null) playerRef.current?.setAudioTrack(mpvId);
  }, [audioIndex, isDirectPlay, mpvTrackMap, playerRef]);

  /** Reset l'état externe sub loaded — à appeler quand l'item ou la session change. */
  const resetExternalSubsLoaded = useCallback(() => {
    externalSubsLoaded.current = false;
  }, []);

  return { mpvTrackMap, subtitleTrackMap, handleTracks, resetExternalSubsLoaded };
}
