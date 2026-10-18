import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, PREVIEW_ZONE_TEXT, previewZoneTextLayout } from "@tentacle-tv/tv-core";
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
 * `heroRoom` : sous le héros, le texte remonte au-dessus de ses boutons et se
 * resserre (logo moins haut, synopsis sur deux lignes, une avec une raison).
 * La méta tient sur UNE ligne (coupée à droite, jamais d'orphelin à la ligne) :
 * le gabarit est fixe, et le bloc ne dépasse jamais la marge sûre du haut — il
 * est calé en bas, et ce qui ne tiendrait pas est coupé (lot 1 du testeur :
 * une méta sur deux lignes poussait le surtitre hors de l'écran).
 */

/** Le titre écrit (faute de logo) : deux lignes au plus, sans rétrécir ; borné par la hauteur du logo. */
function titleSize(title: string, compact: boolean): number {
  const size = title.length <= 14 ? 68 : title.length <= 24 ? 60 : 52;
  return compact ? size - 8 : size;
}

export const ZoneText = memo(function ZoneText({ model, heroRoom }: { model: PreviewZoneModel; heroRoom: boolean }) {
  const { shown, progress } = useSwap(model.key, model, PREVIEW_ZONE_FADE.textMs, PREVIEW_ZONE_FADE.textMs);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const compact = heroRoom || Boolean(shown.reason || shown.kicker);
  const layout = previewZoneTextLayout({
    height: ZONE.height,
    hero: heroRoom,
    kicker: Boolean(shown.kicker),
    reason: Boolean(shown.reason),
    synopsis: Boolean(shown.synopsis),
  });
  return (
    <Animated.View style={[styles.block, { bottom: layout.bottom }, fade]}>
      <View style={styles.stack}>
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
        maxHeight={layout.logoMaxHeight}
        fontSize={Math.min(titleSize(shown.title, compact), layout.logoMaxHeight / 2)}
      />
      {shown.meta.length > 0 ? <MetaLine items={shown.meta} singleLine /> : null}
      {shown.synopsis && layout.synopsisLines > 0 ? (
        <Text style={[text.body, styles.synopsis]} numberOfLines={layout.synopsisLines}>{shown.synopsis}</Text>
      ) : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // De la marge sûre du haut jusqu'à `bottom` : calé en bas, rien ne dépasse en haut.
  block: { position: "absolute", left: ZONE.left, top: PREVIEW_ZONE_TEXT.safeTop, width: ZONE.textWidth, justifyContent: "flex-end", overflow: "hidden" },
  stack: { gap: PREVIEW_ZONE_TEXT.gap },
  reason: { gap: 8 },
  reasonLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 25, color: white(0.92), flexShrink: 1 },
  synopsis: { maxWidth: 780, color: white(0.86) },
});
