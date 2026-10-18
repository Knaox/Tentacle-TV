import { memo, useCallback, useEffect } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, PREVIEW_ZONE_PLAYBACK, PREVIEW_ZONE_TEXT, previewZoneTextLayout, previewZoneUsesLogo } from "@tentacle-tv/tv-core";
import { MetaLine } from "../hero/MetaLine";
import { TitleArt } from "../hero/TitleArt";
import { Icon } from "../icons/Icon";
import { useSwap } from "../motion/useSwap";
import { colors, fonts, text, white } from "../theme/tokens";
import { ZONE, type PreviewZoneModel } from "./zoneModel";
import { ZoneSynopsis } from "./ZoneSynopsis";

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
 *
 * Aucun « … » au milieu d'un mot : le synopsis garde ses phrases entières
 * (`ZoneSynopsis`), le surtitre et la raison se resserrent plutôt que d'être
 * coupés. PENDANT LA BANDE-ANNONCE (`watch` : 0 au repos, 1 quand la vidéo
 * joue — tv-core `previewZoneWatching`), tout s'efface sauf le logo, qui se
 * réduit et descend au bas du bloc, à la place de la méta et du synopsis
 * (sa hauteur, mesurée) : des transformations et des opacités seulement.
 */

/** Le titre écrit (faute de logo) : deux lignes au plus, sans rétrécir ; borné par la hauteur du logo. */
function titleSize(title: string, compact: boolean): number {
  const size = title.length <= 14 ? 68 : title.length <= 24 ? 60 : 52;
  return compact ? size - 8 : size;
}

export const ZoneText = memo(function ZoneText({ model, heroRoom, watch }: {
  model: PreviewZoneModel;
  heroRoom: boolean;
  watch: SharedValue<number>;
}) {
  const { shown, progress } = useSwap(model.key, model, PREVIEW_ZONE_FADE.textMs, PREVIEW_ZONE_FADE.textMs);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const compact = heroRoom || Boolean(shown.reason || shown.kicker);
  const layout = previewZoneTextLayout({
    hero: heroRoom,
    kicker: Boolean(shown.kicker),
    reason: Boolean(shown.reason),
    synopsis: Boolean(shown.synopsis),
  });
  // Ce qui se retire devant la vidéo.
  const recede = useAnimatedStyle(() => ({ opacity: 1 - watch.value }));
  // La place que la méta et le synopsis laissent au logo qui descend.
  const shift = useSharedValue(0);
  const onDetailsLayout = useCallback(
    (event: LayoutChangeEvent) => {
      shift.value = event.nativeEvent.layout.height + PREVIEW_ZONE_TEXT.gap;
    },
    [shift],
  );
  const hasDetails = shown.meta.length > 0 || Boolean(shown.synopsis && layout.synopsisLines > 0);
  useEffect(() => {
    if (!hasDetails) shift.value = 0;
  }, [hasDetails, shift]);
  const title = useAnimatedStyle(() => ({
    transform: [{ translateY: watch.value * shift.value }, { scale: 1 - watch.value * (1 - PREVIEW_ZONE_PLAYBACK.titleScale) }],
  }));
  return (
    <Animated.View style={[styles.block, { bottom: layout.bottom }, fade]}>
      <View style={styles.stack}>
      {shown.kicker || shown.reason ? (
        <Animated.View style={[styles.reason, recede]}>
          {shown.kicker ? <Text style={text.kicker} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{shown.kicker}</Text> : null}
          {shown.reason ? (
            <View style={styles.reasonLine}>
              <Icon name="sparkles" size={24} color={colors.accentLight} />
              <Text style={styles.reasonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{shown.reason}</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.title, title]}>
        <TitleArt
          title={shown.title}
          logoUri={shown.logoUri}
          maxWidth={shown.logoUri ? 560 : ZONE.textWidth}
          maxHeight={layout.logoMaxHeight}
          fontSize={Math.min(titleSize(shown.title, compact), layout.logoMaxHeight / 2)}
          acceptsLogo={previewZoneUsesLogo}
        />
      </Animated.View>
      {hasDetails ? (
        <Animated.View style={recede}>
          <View style={styles.details} onLayout={onDetailsLayout}>
            {shown.meta.length > 0 ? <MetaLine items={shown.meta} singleLine /> : null}
            {shown.synopsis && layout.synopsisLines > 0 ? <ZoneSynopsis synopsis={shown.synopsis} lines={layout.synopsisLines} /> : null}
          </View>
        </Animated.View>
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
  // Réduit vers son coin bas gauche : il reste aligné sur le contenu de la page.
  title: { alignSelf: "flex-start", transformOrigin: "left bottom", zIndex: 1 },
  details: { gap: PREVIEW_ZONE_TEXT.gap },
});
