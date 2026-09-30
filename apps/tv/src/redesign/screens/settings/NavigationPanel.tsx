import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PillButton } from "../../controls/PillButton";
import { NavOrderRow } from "./NavOrderRow";
import { SectionTitle } from "./settingsParts";
import type { SettingsNavigation } from "./settingsTypes";

/**
 * L'onglet Navigation : ce que montre la barre de gauche, et dans quel ordre —
 * pensé pour beaucoup de bibliothèques. Toutes les entrées organisables sont
 * là, masquées comprises, dans l'ordre de la barre : OK sur une ligne la
 * soulève (HAUT / BAS la déplacent, OK la pose, Retour annule) ; la pastille
 * de droite l'affiche ou la masque. « Tout afficher » et « Ordre par défaut »
 * ne paraissent que s'ils ont quelque chose à faire.
 *
 * Branchement : le magasin d'épinglage partagé (`useRailPinning` : masquées
 * et ordre choisi, `applyRailOrder`), les bibliothèques (`useLibraries`) ; le
 * déplacement vit dans l'intégration (`movingKey`, l'ordre en cours).
 *
 * Clés de focus : `settings:nav:<i>`, `settings:nav:<i>:visibility`,
 * `settings:nav:showAll`, `settings:nav:resetOrder`.
 */

export interface NavigationPanelProps {
  navigation: SettingsNavigation;
  onMoveEntry?: (key: string) => void;
  onToggleEntry?: (key: string) => void;
  onShowAll?: () => void;
  onResetOrder?: () => void;
}

export const NavigationPanel = memo(function NavigationPanel({
  navigation,
  onMoveEntry,
  onToggleEntry,
  onShowAll,
  onResetOrder,
}: NavigationPanelProps) {
  const { t } = useTranslation(["preferences", "nav"]);
  const { entries, movingKey, canShowAll, canResetOrder } = navigation;
  return (
    <View style={styles.root}>
      <View>
        <SectionTitle title={t("preferences:navigationTitle")} caption={t("preferences:navigationCaption")} />
        {canShowAll || canResetOrder ? (
          <View style={styles.actions}>
            {canShowAll ? (
              <PillButton label={t("nav:railShowAll")} icon="eye" size="md" focusKey="settings:nav:showAll" onPress={onShowAll} />
            ) : null}
            {canResetOrder ? (
              <PillButton
                label={t("preferences:navigationResetOrder")}
                icon="replay"
                size="md"
                focusKey="settings:nav:resetOrder"
                onPress={onResetOrder}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.list}>
        {entries.map((entry, index) => (
          <NavOrderRow
            key={`slot:${index}`}
            index={index}
            entry={entry}
            moving={entry.key === movingKey}
            onMove={onMoveEntry}
            onToggle={onToggleEntry}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 36 },
  actions: { flexDirection: "row", gap: 16, marginTop: 6 },
  list: { gap: 10 },
});
