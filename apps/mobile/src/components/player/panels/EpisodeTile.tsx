import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { CardDeviceState, CardStatusKind } from "@tentacle-tv/shared";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";
import { PANEL, PANEL_TYPE } from "./panelTokens";

/** Hauteur FIXE d'une ligne (liste debout) : la liste se place sur l'épisode en cours sans mesurer. */
export const EPISODE_ROW_HEIGHT = 92;

export interface EpisodeTileModel {
  id: string;
  /** « Épisode 3 » — ou rien quand Jellyfin n'a pas de numéro. */
  numberLabel?: string;
  /** « 42 min ». */
  durationLabel?: string;
  title: string;
  overview?: string;
  /** De 0 à 100 ; `null` : pas de barre (non entamé, ou vu). */
  progress: number | null;
  statuses: readonly CardStatusKind[];
  /** « Sur cet appareil » au bout de la pastille. */
  device?: CardDeviceState | null;
  current: boolean;
}

interface Props {
  model: EpisodeTileModel;
  /** La vignette 16:9 (en ligne ou gardée sur l'appareil). */
  artwork: ReactNode;
  /** `card` : vignette au-dessus (étagère) ; `row` : vignette à gauche (liste). */
  layout: "card" | "row";
  width?: number;
  onPress: () => void;
}

/**
 * Un épisode, comme dans l'app TV d'Apple : la vignette 16:9 et son état
 * (barre de progression, pastille « vu » des cartes), le numéro et la durée en
 * gris, le titre ; l'épisode en cours dit « En cours » à la place du numéro.
 */
export const EpisodeTile = memo(function EpisodeTile({ model, artwork, layout, width, onPress }: Props) {
  const { t } = useTranslation("player");
  const meta = [model.current ? t("panels.nowPlaying") : model.numberLabel, model.durationLabel].filter(Boolean).join(" · ");
  const card = layout === "card";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: model.current }}
      accessibilityLabel={[model.numberLabel, model.title, model.durationLabel].filter(Boolean).join(", ")}
      style={({ pressed }) => [card ? [st.card, { width }] : st.row, model.current && !card && st.rowCurrent, pressed && st.pressed]}
    >
      <View style={[st.thumb, card ? st.thumbCard : st.thumbRow, model.current && st.thumbCurrent]}>
        {artwork}
        {model.progress !== null && (
          <View style={st.track}><View style={[st.fill, { width: `${model.progress}%` }]} /></View>
        )}
        <CardStatusMarkers statuses={model.statuses} device={model.device ?? null} style={st.status} />
      </View>
      <View style={card ? st.textCard : st.textRow}>
        {meta ? <Text numberOfLines={1} style={[st.meta, model.current && st.metaCurrent]}>{meta}</Text> : null}
        <Text numberOfLines={2} style={st.title}>{model.title}</Text>
        {!card && model.overview ? <Text numberOfLines={2} style={st.overview}>{model.overview}</Text> : null}
      </View>
    </Pressable>
  );
});

const st = StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, height: EPISODE_ROW_HEIGHT, paddingHorizontal: 10, borderRadius: 14, overflow: "hidden" },
  rowCurrent: { backgroundColor: PANEL.current },
  pressed: { opacity: 0.72 },
  thumb: { aspectRatio: 16 / 9, borderRadius: 10, overflow: "hidden", backgroundColor: PANEL.thumbFallback },
  thumbCard: { width: "100%" },
  thumbRow: { width: 132 },
  // L'épisode en cours : un liseré blanc, comme le focus de l'app TV.
  thumbCurrent: { borderWidth: 2, borderColor: PANEL.label },
  track: { position: "absolute", left: 8, right: 8, bottom: 7, height: 4, borderRadius: 2, backgroundColor: PANEL.progressTrack, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, backgroundColor: PANEL.progressFill },
  status: { top: 5, right: 5 },
  textCard: { gap: 2, paddingHorizontal: 2 },
  textRow: { flex: 1, gap: 2 },
  meta: { color: PANEL.secondary, fontSize: PANEL_TYPE.detail, fontWeight: "500", fontVariant: ["tabular-nums"] },
  metaCurrent: { color: PANEL.label, fontWeight: "700" },
  title: { color: PANEL.label, fontSize: 15, fontWeight: "600", lineHeight: 19 },
  overview: { color: PANEL.secondary, fontSize: PANEL_TYPE.detail, lineHeight: 17, marginTop: 2 },
});
