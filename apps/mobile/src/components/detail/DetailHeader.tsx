import { type ComponentProps } from "react";
import { View, Pressable } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, RADIUS, useTheme } from "../../theme";
import { DetailActionsRow } from "./DetailActionsRow";
import { DetailPlayCta } from "./DetailPlayCta";
import { DetailStageBlock } from "./DetailStageBlock";
import { detailPlayCta } from "./computeBadges";
import { ENABLE_SHARED_POSTER_TRANSITION } from "../../constants/featureFlags";
import type { useMediaDetailAnimations } from "../../hooks/useMediaDetailAnimations";

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

interface Props {
  item: MediaItem;
  /** Paysage iPad : tout empilé dans la colonne gauche ; sinon, sous la scène. */
  twoCol: boolean;
  isEpisode: boolean;
  seriesWatchState: SeriesWatchState;
  posterW: number;
  posterH: number;
  actions: ComponentProps<typeof DetailActionsRow>;
  anims: ReturnType<typeof useMediaDetailAnimations>;
  /** Ouvre la vue « image plein écran » sur l'affiche (iPad paysage). */
  onOpenPoster?: () => void;
}

/**
 * Sous la scène de la fiche : le bouton Lecture au dégradé de marque puis la
 * rangée d'actions (Favoris / Ma liste / Vu / Garder hors ligne), centrés sur
 * 420. Le bloc titre, lui, vit DANS la scène (`MediaDetailScreen`).
 *
 * iPad paysage (`twoCol`) : la colonne gauche figée reprend tout — affiche (qui
 * ouvre la vue plein écran), bloc titre en ton « page », Lecture, actions.
 */
export function DetailHeader({ item, twoCol, isEpisode, seriesWatchState, posterW, posterH, actions, anims, onOpenPoster }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { t: tm } = useTranslation("media");
  const client = useJellyfinClient();
  const theme = useTheme();
  const cta = detailPlayCta(item, seriesWatchState, t);

  const playEl = cta.targetId ? (
    <Animated.View style={[{ marginTop: spacing.xl, alignItems: "center" }, anims.actionsStyle]}>
      <DetailPlayCta cta={cta} title={item.Name} onPress={() => router.push(`/watch/${cta.targetId}`)} />
    </Animated.View>
  ) : null;
  const actionsEl = (
    <Animated.View style={[{ width: "100%", maxWidth: 452, alignSelf: "center" }, anims.actionsStyle]}>
      <DetailActionsRow {...actions} />
    </Animated.View>
  );

  if (!twoCol) {
    return (
      <>
        <View style={{ paddingHorizontal: spacing.screenPadding }}>{playEl}</View>
        {actionsEl}
      </>
    );
  }

  const posterId = isEpisode ? (item.SeriesId ?? item.Id) : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { height: 500, quality: 90 });
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <Pressable onPress={onOpenPoster} disabled={!onOpenPoster} accessibilityRole="imagebutton" accessibilityLabel={tm("detailOpenPoster")}>
        <Animated.View style={[{ width: posterW, height: posterH }, ENABLE_SHARED_POSTER_TRANSITION ? undefined : anims.posterStyle]}>
          <Animated.Image
            source={{ uri: poster }}
            style={{ width: posterW, height: posterH, borderRadius: RADIUS.lg, backgroundColor: theme.colors.surface.s2, shadowColor: "#000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 22 }}
            resizeMode="cover"
            {...(ENABLE_SHARED_POSTER_TRANSITION ? { sharedTransitionTag: `poster-${posterId}` } : {})}
          />
          <View style={{ position: "absolute", right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
            <Feather name="maximize-2" size={13} color="#FFFFFF" />
          </View>
        </Animated.View>
      </Pressable>
      <View style={{ marginTop: spacing.lg }}>
        <DetailStageBlock item={item} align="start" tone="themed" logoMaxW={340} logoMaxH={110}
          titleStyle={anims.titleStyle} metaStyle={anims.metaStyle} />
      </View>
      {playEl}
      {actionsEl}
    </View>
  );
}
