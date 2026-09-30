import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TV_STAGE } from "@tentacle-tv/theme";
import { MetaLine } from "../../hero/MetaLine";
import { TitleArt } from "../../hero/TitleArt";
import { fonts, scrim, white } from "../../theme/tokens";
import { CircleButton } from "./CircleButton";
import type { PlayerMedia } from "./playerTypes";

/**
 * Le haut de l'habillage : Retour, puis ce qu'on regarde — le logo de
 * l'œuvre (sinon son titre) et, pour un épisode, « S1 · E3 · Nom ». Les
 * pastilles de la source (4K, Dolby Vision, Atmos) à droite. Un voile du
 * bord réel de la dalle jusque sous le titre.
 */

const SAFE = TV_STAGE.safe;

export const OsdTopBar = memo(function OsdTopBar({
  media,
  backLabel,
  onBack,
}: {
  media: PlayerMedia;
  backLabel: string;
  onBack?: () => void;
}) {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[scrim(0.86), scrim(0.52), scrim(0)]}
        locations={[0, 0.5, 1]}
        style={styles.scrim}
      />
      <View style={styles.bar} pointerEvents="box-none">
        <CircleButton icon="chevronLeft" label={backLabel} size={72} caption={false} focusKey="player:back" onPress={onBack} />
        <View style={styles.titles}>
          <TitleArt title={media.title} logoUri={media.logoUri} maxWidth={560} maxHeight={84} fontSize={46} />
          {media.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{media.subtitle}</Text> : null}
        </View>
      </View>
      {media.badges?.length ? (
        <View style={styles.badges} pointerEvents="none">
          <MetaLine items={media.badges} size={24} />
        </View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, top: 0, height: 330 },
  bar: { position: "absolute", left: SAFE.x, top: SAFE.y, right: 520, flexDirection: "row", alignItems: "center", gap: 28 },
  titles: { flexShrink: 1, gap: 8, paddingTop: 2 },
  subtitle: { ...fonts.semibold, fontSize: 28, lineHeight: 36, color: white(0.86) },
  badges: { position: "absolute", top: SAFE.y + 20, right: SAFE.x },
});
