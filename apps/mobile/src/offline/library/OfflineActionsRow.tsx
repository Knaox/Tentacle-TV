import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DetailActionButton } from "@/components/detail/DetailActionButton";
import { spacing, useTheme } from "@/theme";

interface Props {
  watched: boolean;
  onToggleWatched: () => void;
  onRemove: () => void;
  /** La fiche en ligne du même titre — `null` hors ligne, où elle ne s'ouvrirait pas. */
  onOpenOnline: (() => void) | null;
}

/**
 * Les actions d'une fiche locale, dans la rangée de la fiche en ligne (mêmes
 * cellules rondes, mêmes colonnes) : la coche « vu » — la seule bascule qui
 * vive sur l'appareil —, le retrait de l'appareil (confirmé), et la fiche
 * complète quand le serveur répond. Ni Favoris ni Ma liste : ils passent par
 * le serveur.
 */
export function OfflineActionsRow({ watched, onToggleWatched, onRemove, onOpenOnline }: Props) {
  const { t } = useTranslation(["common", "offline"]);
  const theme = useTheme();
  return (
    <View style={st.row}>
      <DetailActionButton
        icon="check-circle"
        iconActive="check-circle"
        label={t("common:actionWatched")}
        active={watched}
        activeColor={theme.colors.brand.violet}
        fillOnActive
        onPress={onToggleWatched}
      />
      <DetailActionButton
        icon="trash-2"
        label={t("offline:actionRemove")}
        active={false}
        activeColor={theme.colors.status.error}
        onPress={onRemove}
      />
      {onOpenOnline && (
        <DetailActionButton
          icon="info"
          label={t("offline:actionDetails")}
          active={false}
          activeColor={theme.colors.brand.violet}
          onPress={onOpenOnline}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.screenPadding,
    maxWidth: 420 + spacing.screenPadding * 2,
    alignSelf: "center",
    width: "100%",
  },
});
