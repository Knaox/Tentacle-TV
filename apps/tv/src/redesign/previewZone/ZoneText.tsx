import { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { PREVIEW_ZONE_FADE, PREVIEW_ZONE_PLAYBACK, PREVIEW_ZONE_TEXT, previewZoneTextLayout, previewZoneUsesLogo } from "@tentacle-tv/tv-core";
import { MetaLine } from "../hero/MetaLine";
import { TitleArt } from "../hero/TitleArt";
import { Icon } from "../icons/Icon";
import { useSwap } from "../motion/useSwap";
import { colors, fonts, text, white } from "../theme/tokens";
import { ZONE, type PreviewZoneModel } from "./zoneModel";
import { ZoneSynopsis } from "./ZoneSynopsis";
import { ZoneWatchText, type ZoneHintState } from "./ZoneWatchText";

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
 * se montre — tv-core `previewZoneWatching`), le texte du repos passe en
 * fondu croisé à la version allégée mais remplie (`ZoneWatchText`), dans la
 * colonne à gauche de la vidéo : des opacités seulement. Celle-ci n'est
 * montée que pour la vidéo (`watching`) et le temps de son retour : une
 * rafale de flèches, qui ne joue aucune vidéo, ne la crée jamais.
 */

/** Le titre écrit (faute de logo) : deux lignes au plus, sans rétrécir ; borné par la hauteur du logo. */
function titleSize(title: string, compact: boolean): number {
  const size = title.length <= 14 ? 68 : title.length <= 24 ? 60 : 52;
  return compact ? size - 8 : size;
}

export const ZoneText = memo(function ZoneText({ model, heroRoom, watching, watch, hint }: {
  model: PreviewZoneModel;
  heroRoom: boolean;
  /** La vidéo se montre : la version allégée est montée (`watch` en porte le fondu). */
  watching: boolean;
  watch: SharedValue<number>;
  hint: ZoneHintState | null;
}) {
  const watchMounted = useMountedWhile(watching, PREVIEW_ZONE_PLAYBACK.returnMs);
  const { shown, progress } = useSwap(model.key, model, PREVIEW_ZONE_FADE.textMs, PREVIEW_ZONE_FADE.textMs);
  // Le repos et la version allégée, en fondu croisé ; un titre neuf les échange tous deux.
  const rest = useAnimatedStyle(() => ({ opacity: progress.value * (1 - watch.value) }));
  const watchingFade = useAnimatedStyle(() => ({ opacity: progress.value * watch.value }));
  const compact = heroRoom || Boolean(shown.reason || shown.kicker);
  const layout = previewZoneTextLayout({
    hero: heroRoom,
    kicker: Boolean(shown.kicker),
    reason: Boolean(shown.reason),
    synopsis: Boolean(shown.synopsis),
  });
  const hasDetails = shown.meta.length > 0 || Boolean(shown.synopsis && layout.synopsisLines > 0);
  return (
    <>
      <Animated.View style={[styles.block, { bottom: layout.bottom }, rest]}>
        <View style={styles.stack}>
          {shown.kicker || shown.reason ? (
            <View style={styles.reason}>
              {shown.kicker ? <Text style={text.kicker} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{shown.kicker}</Text> : null}
              {shown.reason ? (
                <View style={styles.reasonLine}>
                  <Icon name="sparkles" size={24} color={colors.accentLight} />
                  <Text style={styles.reasonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{shown.reason}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.title}>
            <TitleArt
              title={shown.title}
              logoUri={shown.logoUri}
              maxWidth={shown.logoUri ? 560 : ZONE.textWidth}
              maxHeight={layout.logoMaxHeight}
              fontSize={Math.min(titleSize(shown.title, compact), layout.logoMaxHeight / 2)}
              acceptsLogo={previewZoneUsesLogo}
            />
          </View>
          {hasDetails ? (
            <View style={styles.details}>
              {shown.meta.length > 0 ? <MetaLine items={shown.meta} singleLine /> : null}
              {shown.synopsis && layout.synopsisLines > 0 ? <ZoneSynopsis synopsis={shown.synopsis} lines={layout.synopsisLines} /> : null}
            </View>
          ) : null}
        </View>
      </Animated.View>
      {watchMounted ? <ZoneWatchText shown={shown} heroRoom={heroRoom} hint={hint} style={watchingFade} /> : null}
    </>
  );
});

/** Monté dès que `on`, gardé `exitMs` après (le temps de son fondu de sortie). */
function useMountedWhile(on: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(on);
  if (on && !mounted) setMounted(true);
  useEffect(() => {
    if (on) return undefined;
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [on, exitMs]);
  return mounted;
}

const styles = StyleSheet.create({
  // De la marge sûre du haut jusqu'à `bottom` : calé en bas, rien ne dépasse en haut.
  block: { position: "absolute", left: ZONE.left, top: PREVIEW_ZONE_TEXT.safeTop, width: ZONE.textWidth, justifyContent: "flex-end", overflow: "hidden" },
  stack: { gap: PREVIEW_ZONE_TEXT.gap },
  reason: { gap: 8 },
  reasonLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 25, color: white(0.92), flexShrink: 1 },
  title: { alignSelf: "flex-start" },
  details: { gap: PREVIEW_ZONE_TEXT.gap },
});
