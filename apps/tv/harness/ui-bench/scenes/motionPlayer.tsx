import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { PlayerChromeView, type PlayerChromeViewProps } from "../../../src/redesign/screens/player/PlayerChromeView";
import { seekFlashLabel } from "../../../src/redesign/screens/player/playerLabels";
import type { BenchData } from "../data/benchData";
import { episodeAt, mediaOf, playerLabels, t, timelineOf, transportOf, videoFrameOf } from "../data/playerModels";
import { episodesPanelOf } from "../data/playerPanelModels";
import type { BenchScene } from "./types";

/**
 * Le lecteur en MOUVEMENT (`mouvement/lecteur`) : l'habillage d'un épisode de
 * One Piece passe d'un état à l'autre toutes les 1,5 s — habillage qui
 * paraît, qui s'efface, saut +30 s, panneau des épisodes, habillage qui
 * revient. De quoi regarder les entrées et les sorties, et les mesurer
 * (`bench:ui fps`). La « vidéo » est une image fixe.
 */

type Step = Partial<PlayerChromeViewProps>;

const STEP_MS = 1_500;

function steps(data: BenchData, episodeId: string, seriesId: string | undefined): Step[] {
  const series = seriesId ? data.item(seriesId) : undefined;
  const panel = series ? { kind: "episodes" as const, episodes: episodesPanelOf(data, series, 0, { currentId: episodeId }) } : null;
  return [
    { osdVisible: true },
    { osdVisible: false },
    { osdVisible: false, seekFlash: { forward: true, label: seekFlashLabel(t, 30) } },
    { osdVisible: false },
    { osdVisible: true },
    { osdVisible: true, panel },
    { osdVisible: true },
  ];
}

function CyclingPlayer({ data }: { data: BenchData }) {
  const item = useMemo(() => episodeAt(data, "One Piece", 1, 2), [data]);
  const sequence = useMemo(() => (item ? steps(data, item.Id, item.SeriesId ?? undefined) : []), [data, item]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (sequence.length < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % sequence.length), STEP_MS);
    return () => clearInterval(timer);
  }, [sequence.length]);
  if (!item) return null;
  const frame = videoFrameOf(data, item);
  const props: PlayerChromeViewProps = {
    media: mediaOf(data, item),
    labels: playerLabels(),
    phase: { kind: "playing" },
    timeline: timelineOf(item, 0.3),
    transport: transportOf(data, item),
    paused: false,
    osdVisible: true,
    ...sequence[index],
  };
  return (
    <View style={styles.stage}>
      {frame ? <Image source={{ uri: frame }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <PlayerChromeView {...props} />
    </View>
  );
}

export const MOTION_PLAYER_SCENE: BenchScene = {
  id: "mouvement/lecteur",
  group: "Mouvement",
  label: "L'habillage du lecteur qui paraît, s'efface, ses panneaux (toutes les 1,5 s)",
  settleMs: 1500,
  render: (data) => <CyclingPlayer data={data} />,
};

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#000" },
});
