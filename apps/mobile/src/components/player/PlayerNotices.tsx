import type { QualityDrop } from "@tentacle-tv/shared";
import { PlayerQualityNotice } from "./PlayerQualityNotice";
import { JellyfinOutageBanner } from "./JellyfinOutageBanner";
import { SeekWaitIndicator } from "./SeekWaitIndicator";
import { PlayerStallNotice } from "./PlayerStallNotice";

interface Props {
  itemId: string;
  qualityDrop: QualityDrop | null;
  started: boolean;
  paused: boolean;
  buffering: boolean;
  transcoding: boolean;
  seekPhase: Parameters<typeof SeekWaitIndicator>[0]["phase"];
  canLowerQuality: boolean;
  onLowerQuality: () => void;
  onRetryOutage: () => void;
}

/** Les avis du lecteur serveur, par-dessus l'image : qualité, panne de Jellyfin, saut, lecture qui cale. */
export function PlayerNotices(p: Props) {
  return (
    <>
      <PlayerQualityNotice drop={p.qualityDrop} started={p.started} itemId={p.itemId} />
      <JellyfinOutageBanner onRetry={p.onRetryOutage} />
      <SeekWaitIndicator phase={p.seekPhase} />
      <PlayerStallNotice buffering={p.buffering && p.seekPhase === "idle"} started={p.started} paused={p.paused} transcoding={p.transcoding}
        canLowerQuality={p.canLowerQuality} onLowerQuality={p.onLowerQuality} />
    </>
  );
}
