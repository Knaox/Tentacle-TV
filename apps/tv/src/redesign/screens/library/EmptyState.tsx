import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArtworkHalo } from "../../background/ArtworkHalo";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { PillButton } from "../../controls/PillButton";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, text } from "../../theme/tokens";

/**
 * Un vide qui dit quoi faire, posé DANS la page (sous son en-tête) : un
 * pictogramme dans un disque de verre, sa lumière autour, un titre, une
 * phrase, et au moins une action — sur un téléviseur, un écran sans rien de
 * focalisable est un écran mort.
 *
 * Sert à « aucun titre pour ces filtres » (bibliothèque) et aux listes vides
 * (Ma liste, Favoris, Parcourir). Clés de focus : `empty:primary`,
 * `empty:secondary`.
 */

export interface EmptyAction {
  label: string;
  icon?: IconName;
  onPress?: () => void;
}

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  primary?: EmptyAction;
  secondary?: EmptyAction;
  /** La lumière du disque (celle de la page). */
  palette?: ArtworkPalette;
}

const DISC = 148;

export const EmptyState = memo(function EmptyState({ icon, title, message, primary, secondary, palette }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <View style={styles.disc}>
        {palette ? <ArtworkHalo width={DISC} height={DISC} radius={DISC / 2} palette={palette} spread={10} blur={30} opacity={0.55} /> : null}
        <GlassSurface radius={DISC / 2} tone="clear" style={styles.discGlass} elevated>
          <Icon name={icon} size={64} color={colors.text} strokeWidth={1.8} />
        </GlassSurface>
      </View>
      <Text style={[text.heading, styles.center]}>{title}</Text>
      {message ? <Text style={[text.body, styles.center, styles.message]}>{message}</Text> : null}
      {primary || secondary ? (
        <View style={styles.actions}>
          {primary ? <PillButton variant="primary" label={primary.label} icon={primary.icon} focusKey="empty:primary" onPress={primary.onPress} /> : null}
          {secondary ? <PillButton variant="glass" label={secondary.label} icon={secondary.icon} focusKey="empty:secondary" onPress={secondary.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: 20 },
  disc: { width: DISC, height: DISC, marginBottom: 14 },
  discGlass: { width: DISC, height: DISC, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  message: { maxWidth: 820 },
  actions: { flexDirection: "row", gap: 18, marginTop: 16 },
});
