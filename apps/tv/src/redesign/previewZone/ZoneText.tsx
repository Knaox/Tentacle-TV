import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE } from "@tentacle-tv/tv-core";
import { MetaLine } from "../hero/MetaLine";
import { TitleArt } from "../hero/TitleArt";
import { Icon } from "../icons/Icon";
import { useSwap } from "../motion/useSwap";
import { colors, fonts, text, white } from "../theme/tokens";
import { ZONE, type PreviewZoneModel } from "./zoneModel";

/**
 * Le TEXTE de la zone d'aperçu, calé en bas à gauche : la raison, le logo (ou
 * le titre écrit), la ligne de métadonnées, le synopsis. Un titre neuf
 * l'échange en fondu bref (`useSwap` : il sort, change invisible, rentre) ;
 * les détails du même titre (synopsis, genres) s'y posent sur place.
 *
 * `room` : sous le héros de l'Accueil, le texte remonte au-dessus de ses
 * boutons et se resserre (synopsis sur deux lignes, logo moins haut) — tout
 * tient dans la zone.
 */

/** Le titre écrit (faute de logo) : deux lignes au plus, sans rétrécir. */
function titleSize(title: string, compact: boolean): number {
  const size = title.length <= 14 ? 68 : title.length <= 24 ? 60 : 52;
  return compact ? size - 8 : size;
}

export const ZoneText = memo(function ZoneText({ model, heroRoom }: { model: PreviewZoneModel; heroRoom: boolean }) {
  const { shown, progress } = useSwap(model.key, model, PREVIEW_ZONE_FADE.textMs, PREVIEW_ZONE_FADE.textMs);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const compact = heroRoom || Boolean(shown.reason || shown.kicker);
  const bottom = heroRoom ? ZONE.bottom + ZONE.heroActions + ZONE.heroActionsGap : ZONE.bottom;
  return (
    <Animated.View style={[styles.block, { bottom }, fade]}>
      {shown.kicker || shown.reason ? (
        <View style={styles.reason}>
          {shown.kicker ? <Text style={text.kicker} numberOfLines={1}>{shown.kicker}</Text> : null}
          {shown.reason ? (
            <View style={styles.reasonLine}>
              <Icon name="sparkles" size={24} color={colors.accentLight} />
              <Text style={styles.reasonText} numberOfLines={1}>{shown.reason}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <TitleArt
        title={shown.title}
        logoUri={shown.logoUri}
        maxWidth={shown.logoUri ? 560 : ZONE.textWidth}
        maxHeight={compact ? 96 : 124}
        fontSize={titleSize(shown.title, compact)}
      />
      {shown.meta.length > 0 ? <MetaLine items={shown.meta} /> : null}
      {shown.synopsis ? (
        <Text style={[text.body, styles.synopsis]} numberOfLines={heroRoom ? 2 : 3}>{shown.synopsis}</Text>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  block: { position: "absolute", left: ZONE.left, width: ZONE.textWidth, gap: 14 },
  reason: { gap: 8 },
  reasonLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 25, color: white(0.92), flexShrink: 1 },
  synopsis: { maxWidth: 780, color: white(0.86) },
});
