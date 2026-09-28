import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MediaItem } from "@tentacle-tv/shared";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { spacing, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

export interface SelectableGridCardProps {
  item: MediaItem;
  width: number;
  /** La sélection multiple est ouverte : la case se montre, le tap coche. */
  selectable?: boolean;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * Une carte des grilles de collection (Ma liste, Mes favoris) : l'affiche de
 * toutes les rangées (`MobileMediaCard` — marqueurs communs, note, repli
 * d'image, même titre), plus la case de la sélection multiple. Elle avait sa
 * propre affiche, et une coche « vu » maison qui prenait la place de la
 * pastille d'états dès que l'écran oubliait de lui passer l'item.
 */
export const SelectableGridCard = memo(function SelectableGridCard({
  item,
  width,
  selectable,
  selected,
  onPress,
  onLongPress,
}: SelectableGridCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.slot}>
      <MobileMediaCard
        item={item}
        width={width}
        onPress={onPress}
        onLongPress={onLongPress}
        selected={selectable ? selected === true : undefined}
        overlay={selectable ? (
          <View style={[StyleSheet.absoluteFill, styles.selectOverlay, selected && styles.selectOverlayActive]} pointerEvents="none">
            <View style={[styles.checkbox, selected && styles.checkboxActive]}>
              {selected && <Feather name="check" size={14} color={colors.brand.light} />}
            </View>
          </View>
        ) : null}
      />
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    slot: { marginBottom: spacing.md },
    // La case au coin BAS-droit, comme dans Photos : le haut-droit porte la
    // pastille d'états, le bas-gauche la note — la case n'en masque aucune.
    selectOverlay: {
      backgroundColor: t.colors.overlay.scrimSoft,
      justifyContent: "flex-end",
      alignItems: "flex-end",
      padding: spacing.xs + 2,
      borderRadius: RADIUS.lg,
    },
    selectOverlayActive: {
      borderWidth: 2,
      borderColor: t.colors.brand.violet,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.18, t.colors.brand.ghost),
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.colors.cta.brandFg,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: t.colors.overlay.scrimSoft,
    },
    checkboxActive: {
      backgroundColor: t.colors.brand.soft,
      borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.brand.glow),
    },
  });
