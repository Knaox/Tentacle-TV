import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import type { ViewStyle } from "react-native";
import { PREVIEW_ZONE_HINT, PREVIEW_ZONE_TEXT, PREVIEW_ZONE_WATCH, previewZoneUsesLogo, previewZoneWatchLayout } from "@tentacle-tv/tv-core";
import { MetaLine } from "../hero/MetaLine";
import { TitleArt } from "../hero/TitleArt";
import { Reveal } from "../motion/Reveal";
import { fonts } from "../theme/tokens";
import { ZONE, type PreviewZoneModel } from "./zoneModel";
import { ZoneRemoteHint } from "./ZoneRemoteHint";
import { ZoneSynopsis } from "./ZoneSynopsis";

/**
 * La version ALLÉGÉE mais REMPLIE de la zone, pendant la bande-annonce (tv-core
 * `previewZoneWatchLayout`) : dans la colonne à gauche de la vidéo — jamais
 * par-dessus —, le logo plus petit, la ligne de métadonnées, une description
 * courte en phrases entières (jamais un « … »), et l'indice de la
 * télécommande, qui se lit au départ puis s'efface (`hint`, tv-core
 * `previewZoneHintShown`).
 *
 * Montée pour la vidéo seulement (`ZoneText`), à côté du texte du repos ;
 * `style` porte le fondu croisé : aucune remise en page à l'entrée de la
 * vidéo.
 */

export interface ZoneHintState {
  paused: boolean;
  muted: boolean;
  shown: boolean;
}

export const ZoneWatchText = memo(function ZoneWatchText({ shown, heroRoom, hint, style }: {
  shown: PreviewZoneModel;
  heroRoom: boolean;
  hint: ZoneHintState | null;
  style: AnimatedStyle<ViewStyle>;
}) {
  const layout = previewZoneWatchLayout({ hero: heroRoom, synopsis: Boolean(shown.synopsis), left: ZONE.left, mediaLeft: ZONE.mediaLeft });
  return (
    <Animated.View style={[styles.block, { bottom: layout.bottom, width: layout.width }, style]}>
      <View style={styles.stack}>
        <TitleArt
          title={shown.title}
          logoUri={shown.logoUri}
          maxWidth={layout.width}
          maxHeight={layout.logoMaxHeight}
          fontSize={Math.min(46, layout.logoMaxHeight / 2)}
          acceptsLogo={previewZoneUsesLogo}
        />
        {shown.meta.length > 0 ? <MetaLine items={shown.meta} size={22} singleLine /> : null}
        {shown.synopsis && layout.synopsisLines > 0 ? (
          <ZoneSynopsis synopsis={shown.synopsis} lines={layout.synopsisLines} width={layout.width} textStyle={styles.synopsis} clauses={false} />
        ) : null}
        <View style={styles.hintRow}>
          <Reveal shown={hint?.shown ?? false} motion={PREVIEW_ZONE_HINT.fadeOutMs}>
            {hint ? <ZoneRemoteHint paused={hint.paused} muted={hint.muted} /> : null}
          </Reveal>
        </View>
      </View>
    </Animated.View>
  );
});

const W = PREVIEW_ZONE_WATCH;

const styles = StyleSheet.create({
  // De la marge sûre du haut jusqu'à `bottom` : calé en bas, comme le texte du repos.
  block: { position: "absolute", left: ZONE.left, top: PREVIEW_ZONE_TEXT.safeTop, justifyContent: "flex-end", overflow: "hidden" },
  stack: { gap: W.gap },
  synopsis: { ...fonts.regular, fontSize: 23, lineHeight: W.synopsisLine },
  // La place de l'indice est gardée : il paraît et s'efface sans rien déplacer.
  hintRow: { height: W.hint, justifyContent: "center" },
});
