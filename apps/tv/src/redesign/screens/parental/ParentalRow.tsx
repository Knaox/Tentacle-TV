import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FocusTarget } from "../../focus/FocusTarget";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { NavRowSurface } from "../settings/NavOrderRow";

/**
 * Une LIGNE du contrôle parental simplifié — la même surface dans les deux
 * colonnes (l'âge, les bibliothèques), celle des listes de Réglages : un
 * signe à gauche (le rond d'un choix unique, la case d'une bibliothèque),
 * un pictogramme, le libellé, et à droite un détail ou un pictogramme d'état.
 * `on` éclaire le libellé ; éteint, il passe en retrait.
 */

export const PARENTAL_ROW_HEIGHT = 68;
const DOT = 30;

export const ParentalRow = memo(function ParentalRow({ focusKey, on, label, icon, detail, trailingIcon, leading, accessibilityLabel, onPress }: {
  focusKey: string;
  on: boolean;
  label: string;
  icon?: IconName;
  detail?: string;
  trailingIcon?: IconName;
  /** Le signe de gauche, rendu au repos (`dark` faux) et sous le focus blanc (`dark` vrai). */
  leading: (dark: boolean) => ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} form="row" onPress={onPress} accessibilityLabel={accessibilityLabel}>
      {(focused) => (
        <NavRowSurface focused={focused}>
          {(dark) => {
            const color = dark ? colors.ctaFg : on ? colors.text : colors.textTertiary;
            const quiet = dark ? scrim(0.6) : colors.textSecondary;
            return (
              <View style={styles.row}>
                {leading(dark)}
                {icon ? <Icon name={icon} size={28} color={color} strokeWidth={2.2} /> : null}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {label}
                </Text>
                {detail ? (
                  <Text style={[styles.detail, { color: quiet }]} numberOfLines={1}>
                    {detail}
                  </Text>
                ) : null}
                {trailingIcon ? <Icon name={trailingIcon} size={24} color={dark ? colors.ctaFg : colors.textTertiary} /> : null}
              </View>
            );
          }}
        </NavRowSurface>
      )}
    </FocusTarget>
  );
});

/** Le rond d'un choix unique : cerclé au repos, plein de la couleur de la marque, point au centre, quand il est retenu. */
export function RadioDot({ selected, dark }: { selected: boolean; dark: boolean }) {
  if (selected) {
    return (
      <View style={[styles.dot, styles.dotOn]}>
        <View style={styles.dotCenter} />
      </View>
    );
  }
  return <View style={[styles.dot, { borderColor: dark ? scrim(0.4) : white(0.4) }]} />;
}

const styles = StyleSheet.create({
  row: { height: PARENTAL_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 24 },
  label: { ...fonts.semibold, fontSize: 26, flex: 1 },
  detail: { ...fonts.medium, fontSize: 22, maxWidth: 260 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  dotOn: { borderWidth: 0, backgroundColor: colors.accent },
  dotCenter: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.onAccent },
});
