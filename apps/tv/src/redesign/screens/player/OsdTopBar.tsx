import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { BackButton } from "../../controls/BackButton";
import { MetaLine } from "../../hero/MetaLine";
import { TitleArt } from "../../hero/TitleArt";
import { fonts, scrim, white } from "../../theme/tokens";
import type { PlayerMedia } from "./playerTypes";

/**
 * Le haut de l'habillage : la croix Retour (`BackButton`, en haut à gauche
 * comme partout), puis ce qu'on regarde — le logo de l'œuvre (sinon son
 * titre) et, pour un épisode, « S1 · E3 · Nom ». Les pastilles de la source
 * (4K, Dolby Vision, Atmos) à droite. Un voile du bord réel de la dalle
 * jusque sous le titre. Clé : `player:back`.
 */

const SAFE = TV_STAGE.safe;
/** Le voile du haut, sous le titre et Retour. */
const TOP_SCRIM = 330;

export const OsdTopBar = memo(function OsdTopBar({
  media,
  onBack,
}: {
  media: PlayerMedia;
  /** Plus lu : la croix dit « Retour » elle-même (`common:back`). Gardé tant que l'habillage le passe. */
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <>
      <SoftGradient width={STAGE_SIZE.width} height={TOP_SCRIM} colors={[scrim(0.86), scrim(0.52), scrim(0)]} locations={[0, 0.5, 1]} />
      <View style={styles.bar} pointerEvents="box-none">
        <BackButton focusKey="player:back" onPress={onBack} />
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
  bar: { position: "absolute", left: SAFE.x, top: SAFE.y, right: 520, flexDirection: "row", alignItems: "center", gap: 28 },
  titles: { flexShrink: 1, gap: 8, paddingTop: 2 },
  subtitle: { ...fonts.semibold, fontSize: 28, lineHeight: 36, color: white(0.86) },
  badges: { position: "absolute", top: SAFE.y + 20, right: SAFE.x },
});
