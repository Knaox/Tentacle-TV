import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { trailerOriginLabel, trailerVersionLabelKey, type TrailerQueueItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER } from "@/theme";

interface Props {
  item: TrailerQueueItem;
  index: number;
  count: number;
  language: string | null;
  /** Les sous-titres : `null` quand la vidéo n'en offre pas (pas de bouton). */
  subtitles: { on: boolean; toggle: () => void } | null;
  onClose: () => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}

/** Ce que la liste dit d'une bande-annonce : sa portée, sa version, d'où elle vient (« Saison 6 · VF · AlloCiné »). */
function useDescription(item: TrailerQueueItem, language: string | null): string {
  const { t } = useTranslation("common");
  const scope = item.scope;
  const versionKey = trailerVersionLabelKey(item.version, language);
  return [
    scope?.kind === "season" ? t("trailerScopeSeason", { season: scope.season }) : null,
    versionKey ? t(`trailerVersion_${versionKey}`) : null,
    t(`trailerOrigin_${trailerOriginLabel(item)}`),
  ].filter((part): part is string => !!part).join(" · ");
}

function RoundButton({ icon, label, onPress, active }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      hitSlop={8}
      style={({ pressed }) => [st.round, active && st.roundActive, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={20} color={PLAYER.text} />
    </Pressable>
  );
}

/**
 * Le haut de l'écran des bandes-annonces, au-dessus des commandes natives de
 * la vidéo : fermer, ce qui se joue (nom, portée, version, origine, rang dans
 * la liste), la précédente / la suivante, et les sous-titres quand la vidéo
 * en a. Les commandes de lecture (pause, frise, plein écran) sont celles du
 * système.
 */
export const TrailerChrome = memo(function TrailerChrome({ item, index, count, language, subtitles, onClose, onPrevious, onNext }: Props) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const description = useDescription(item, language);
  return (
    <View pointerEvents="box-none" style={[st.bar, { paddingTop: insets.top + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
      <RoundButton icon="x" label={t("trailerClose")} onPress={onClose} />
      <View style={st.text} pointerEvents="none">
        <Text numberOfLines={1} style={st.title}>{item.name || t("trailer")}</Text>
        <Text numberOfLines={1} style={st.subtitle}>{count > 1 ? `${description} · ${index + 1}/${count}` : description}</Text>
      </View>
      {subtitles && (
        <RoundButton icon="message-square" label={t("trailerSubtitles")} onPress={subtitles.toggle} active={subtitles.on} />
      )}
      {onPrevious && <RoundButton icon="skip-back" label={t("trailerPrevious")} onPress={onPrevious} />}
      {onNext && <RoundButton icon="skip-forward" label={t("trailerNext")} onPress={onNext} />}
    </View>
  );
});

const st = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    backgroundColor: PLAYER.scrimSoft,
  },
  text: { flex: 1, minWidth: 0 },
  title: { color: PLAYER.text, fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  subtitle: { color: PLAYER.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY.medium, marginTop: 2 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PLAYER.controlBg,
  },
  roundActive: { backgroundColor: PLAYER.accentSoft },
});
