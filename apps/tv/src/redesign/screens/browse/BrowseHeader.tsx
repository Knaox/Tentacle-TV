import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { ArtworkHalo } from "../../background/ArtworkHalo";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { PillButton } from "../../controls/PillButton";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text, white } from "../../theme/tokens";

/**
 * L'en-tête de Parcourir : la pilule Retour (la sortie se VOIT, parité LG),
 * puis le portrait rond de la personne — ou, pour un genre et un studio, un
 * disque de verre et son pictogramme —, le surtitre (FILMOGRAPHIE, GENRE,
 * STUDIO), le nom en grand et « N titres · ordre ». La lumière de l'œuvre la
 * plus en vue déborde autour du portrait.
 *
 * Clé de focus : `browse:back`.
 */

export type BrowseKind = "person" | "genre" | "studio";

export interface BrowseHeaderProps {
  kind: BrowseKind;
  kicker: string;
  name: string;
  meta?: string;
  portraitUri?: string;
  /** Initiales quand la personne n'a pas de portrait. */
  initials?: string;
  backLabel: string;
  palette: ArtworkPalette;
  onBack?: () => void;
}

const PORTRAIT = TV_STAGE.card.person.size;

function Portrait({ kind, portraitUri, initials, palette }: Pick<BrowseHeaderProps, "kind" | "portraitUri" | "initials" | "palette">) {
  return (
    <View style={styles.portrait}>
      <ArtworkHalo width={PORTRAIT} height={PORTRAIT} radius={PORTRAIT / 2} palette={palette} spread={14} blur={34} opacity={0.75} />
      {kind === "person" && portraitUri ? (
        <View style={styles.photoFrame}>
          <Image source={{ uri: portraitUri }} style={styles.photo} resizeMode="cover" fadeDuration={0} />
          <View style={styles.ring} pointerEvents="none" />
        </View>
      ) : (
        <GlassSurface radius={PORTRAIT / 2} tone="clear" elevated style={styles.disc}>
          {kind === "person" ? (
            <Text style={styles.initials}>{initials}</Text>
          ) : (
            <Icon name={kind === "genre" ? "tag" : "trailer"} size={72} color={colors.text} strokeWidth={1.6} />
          )}
        </GlassSurface>
      )}
    </View>
  );
}

export const BrowseHeader = memo(function BrowseHeader(props: BrowseHeaderProps) {
  const { kicker, name, meta, backLabel, onBack } = props;
  return (
    <View style={styles.header}>
      <View style={styles.back}>
        <PillButton variant="glass" size="md" icon="chevronLeft" label={backLabel} focusKey="browse:back" onPress={onBack} />
      </View>
      <View style={styles.identity}>
        <Portrait kind={props.kind} portraitUri={props.portraitUri} initials={props.initials} palette={props.palette} />
        <View style={styles.texts}>
          <Text style={text.kicker} numberOfLines={1}>{kicker}</Text>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {meta ? <Text style={[text.body, styles.meta]} numberOfLines={1}>{meta}</Text> : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { marginBottom: 48 },
  back: { alignSelf: "flex-start", marginBottom: 34 },
  identity: { flexDirection: "row", alignItems: "center", gap: 44 },
  portrait: { width: PORTRAIT, height: PORTRAIT },
  photoFrame: { width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2, overflow: "hidden", backgroundColor: colors.surface3 },
  photo: { width: PORTRAIT, height: PORTRAIT },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: PORTRAIT / 2, borderWidth: 1.5, borderColor: white(0.22) },
  disc: { width: PORTRAIT, height: PORTRAIT, alignItems: "center", justifyContent: "center" },
  initials: { ...fonts.extrabold, fontSize: 56, color: colors.text },
  texts: { flex: 1, gap: 8, paddingRight: 120 },
  name: { ...fonts.extrabold, fontSize: 76, lineHeight: 86, letterSpacing: -1.6, color: colors.text },
  meta: { color: "rgba(255, 255, 255, 0.7)" },
});
