import { memo } from "react";
import { Linking, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useItemTrailer } from "@tentacle-tv/api-client";
import { parseYouTubeId, trailerPlaybackKey, type MediaItem } from "@tentacle-tv/shared";
import { MOBILE_TRAILER_PLATFORM } from "@/trailers/trailerPlatform";
import { trailerRouteHref, type TrailerRouteItemType } from "@/trailers/trailerRoute";
import { FONT_FAMILY, RADIUS, spacing, useTheme } from "@/theme";

interface Props {
  item: MediaItem;
  /** Lecture est posée juste au-dessus : 12 d'écart ; seule, 20 comme elle. */
  belowPlay: boolean;
  /** L'entrée de la rangée d'actions (même cadence que Lecture). */
  animStyle?: StyleProp<ViewStyle>;
}

/**
 * La bande-annonce de la fiche, sous « Lecture » — une pilule SECONDAIRE de
 * même largeur (420 au plus), 48 de haut, en verre neutre : une seule action
 * en couleur par fiche, et le libellé entier plutôt qu'un cinquième rond où
 * « Bande-annonce » ne tiendrait pas sur un téléphone de 375.
 *
 * Même règle que toutes les plateformes (`useItemTrailer`, catalogue du
 * serveur) : la bande-annonce LOCALE dans le lecteur de l'app ; sinon la
 * première vidéo en ligne, lue DANS l'app par l'écran `/trailer` — sans
 * publicité, la suivante du catalogue à la fin. Un épisode et une saison ont
 * la leur (leur saison, sinon une autre, sinon la série). Pas de bouton quand
 * il n'y en a aucune.
 */
export const DetailTrailerButton = memo(function DetailTrailerButton({ item, belowPlay, animStyle }: Props) {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const { colors } = useTheme();
  const { target, visible } = useItemTrailer(item, i18n.language, MOBILE_TRAILER_PLATFORM);
  if (!visible) return null;

  const open = () => {
    if (!target) return;
    if (target.kind === "local") {
      router.push(`/watch/${target.itemId}`);
    } else if (target.kind === "relay") {
      // Le catalogue de la fiche, à partir de cette bande-annonce (la même requête, déjà en cache).
      const itemType = item.Type as TrailerRouteItemType;
      router.push(trailerRouteHref({ target: { kind: "item", itemId: item.Id, itemType }, start: trailerPlaybackKey(target.entry.playback) }) as never);
    } else {
      // Un serveur d'avant le catalogue : sa vidéo YouTube, par le relais.
      const ytId = parseYouTubeId(target.trailer.Url);
      if (ytId) router.push(trailerRouteHref({ target: { kind: "youtube", ytId, name: target.trailer.Name } }) as never);
      else Linking.openURL(target.trailer.Url).catch(() => {});
    }
  };

  return (
    <Animated.View style={[{ marginTop: belowPlay ? spacing.md : spacing.xl, alignItems: "center" }, animStyle]}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t("watchTrailer")}
        style={({ pressed }) => [
          st.pill,
          { backgroundColor: colors.fill.subtle, borderColor: colors.border.subtle },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Feather name="film" size={18} color={colors.text.primary} />
        <Text numberOfLines={1} style={[st.label, { color: colors.text.primary }]}>{t("trailer")}</Text>
      </Pressable>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  pill: {
    width: "100%",
    maxWidth: 420,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  label: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, letterSpacing: 0.2, flexShrink: 1 },
});
