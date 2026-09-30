import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { PillButton } from "../../controls/PillButton";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { white } from "../../theme/tokens";
import { SOFT_BASE } from "./surfaces";
import { CircleButton } from "./CircleButton";
import type { PlayerLabels, PlayerTransport } from "./playerTypes";

/**
 * La rangée de commandes, centrée : précédent, −10 s, LECTURE/PAUSE (le
 * disque blanc, seule action principale), +30 s, déplacement, suivant — puis,
 * après un filet, les pilules de verre « Épisodes » (série) et « Pistes »
 * (audio, sous-titres, qualité), dont le libellé se lit sans focus.
 *
 * Clés de focus : `player:prev`, `player:seekback`, `player:playpause`,
 * `player:seekforward`, `player:scrub`, `player:next`, `player:episodes`,
 * `player:tracks`.
 */

export interface OsdControlsProps {
  transport: PlayerTransport;
  paused: boolean;
  labels: PlayerLabels;
  onPlayPause?: () => void;
  onSeekBack?: () => void;
  onSeekForward?: () => void;
  onScrub?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenEpisodes?: () => void;
  onOpenTracks?: () => void;
}

export const OsdControls = memo(function OsdControls({
  transport,
  paused,
  labels,
  onPlayPause,
  onSeekBack,
  onSeekForward,
  onScrub,
  onPrevious,
  onNext,
  onOpenEpisodes,
  onOpenTracks,
}: OsdControlsProps) {
  const backing = useNativeGlassBacking("clear");
  return (
    <View style={styles.row} pointerEvents="box-none">
      {transport.hasPrevious ? (
        <CircleButton icon="skipPrevious" label={labels.previous} focusKey="player:prev" onPress={onPrevious} />
      ) : null}
      <CircleButton
        seconds={{ value: transport.seekBackSeconds, forward: false }}
        label={labels.seekBack}
        focusKey="player:seekback"
        onPress={onSeekBack}
      />
      <CircleButton
        primary
        size={96}
        icon={paused ? "play" : "pause"}
        label={paused ? labels.play : labels.pause}
        focusKey="player:playpause"
        onPress={onPlayPause}
      />
      <CircleButton
        seconds={{ value: transport.seekForwardSeconds, forward: true }}
        label={labels.seekForward}
        focusKey="player:seekforward"
        onPress={onSeekForward}
      />
      <CircleButton icon="fastForward" label={labels.seekMode} focusKey="player:scrub" onPress={onScrub} />
      {transport.hasNext ? <CircleButton icon="skipNext" label={labels.next} focusKey="player:next" onPress={onNext} /> : null}
      <View style={styles.rule} />
      {transport.hasEpisodes ? (
        <View style={[styles.base, backing]}>
          <PillButton variant="glass" icon="layers" label={labels.episodes} focusKey="player:episodes" onPress={onOpenEpisodes} />
        </View>
      ) : null}
      <View style={[styles.base, backing]}>
        <PillButton variant="glass" icon="subtitles" label={labels.tracks} focusKey="player:tracks" onPress={onOpenTracks} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 30, height: 96 },
  base: { borderRadius: 34, backgroundColor: SOFT_BASE },
  rule: { width: 2, height: 44, borderRadius: 1, backgroundColor: white(0.22), marginHorizontal: 6 },
});
