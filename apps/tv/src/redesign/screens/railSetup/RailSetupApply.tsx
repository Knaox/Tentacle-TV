import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import {
  RAIL_SETUP_APPLY_ACTIONS_GROUP,
  RAIL_SETUP_APPLY_CONFIRM_KEY,
  RAIL_SETUP_APPLY_DECLINE_KEY,
  RAIL_SETUP_APPLY_TILES_GROUP,
  railSetupApplyEnabled,
  railSetupApplyTileKey,
} from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusSection } from "../../focus/FocusSection";
import { colors, text } from "../../theme/tokens";
import { ApplyProfileTile } from "./ApplyProfileTile";
import type { RailSetupModel, RailSetupViewProps } from "./railSetupTypes";

type ApplyModel = Extract<RailSetupModel, { kind: "apply" }>;

/**
 * « Appliquer aussi à d'autres profils ? » — l'étape du PROPRIÉTAIRE, après
 * « Continuer » (ou depuis Réglages › Navigation) : la rangée des autres
 * profils de cette TV, à cocher, puis « Appliquer à 2 profils » et « Non
 * merci » (« Annuler » depuis les réglages). « Appliquer » reste estompé et
 * hors d'atteinte tant qu'aucun profil n'est coché (tv-core
 * `railSetupApplyEnabled`). Un profil déjà configuré le dit, et reste
 * cochable : appliquer remplace sa barre.
 */
export const RailSetupApply = memo(function RailSetupApply({ model, onToggleTarget, onApply, onDecline }: {
  model: ApplyModel;
} & Pick<RailSetupViewProps, "onToggleTarget" | "onApply" | "onDecline">) {
  const { t } = useTranslation("nav");
  const selected = model.targets.filter((target) => target.selected).map((target) => target.userId);
  const enabled = railSetupApplyEnabled(selected) && !model.busy;
  const confirm = selected.length > 0 ? t("railSetup.applyConfirmCount", { count: selected.length }) : t("railSetup.applyConfirm");

  return (
    <View style={styles.center}>
      <Text style={styles.title}>{t("railSetup.applyTitle")}</Text>
      <Text style={styles.subtitle}>{t("railSetup.applySubtitle")}</Text>
      <FocusSection focusKey={RAIL_SETUP_APPLY_TILES_GROUP} style={styles.tiles}>
        {model.targets.map((target, index) => (
          <ApplyProfileTile
            key={target.userId}
            target={target}
            focusKey={railSetupApplyTileKey(index)}
            disabled={model.busy}
            onPress={onToggleTarget ? () => onToggleTarget(target.userId) : undefined}
          />
        ))}
      </FocusSection>
      <FocusGroup focusKey={RAIL_SETUP_APPLY_ACTIONS_GROUP} style={styles.actions}>
        <View style={enabled ? null : styles.dimmed}>
          <PillButton variant="primary" label={confirm} icon="check" focusKey={RAIL_SETUP_APPLY_CONFIRM_KEY} disabled={!enabled} onPress={onApply} />
        </View>
        <PillButton
          label={t(model.origin === "settings" ? "railSetup.applyCancel" : "railSetup.applyDecline")}
          focusKey={RAIL_SETUP_APPLY_DECLINE_KEY}
          disabled={model.busy}
          onPress={onDecline}
        />
      </FocusGroup>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: TV_STAGE.safe.x },
  title: { ...text.title, textAlign: "center", marginBottom: 18 },
  subtitle: { ...text.body, color: colors.textSecondary, textAlign: "center", maxWidth: 1100, marginBottom: 72 },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 36, maxWidth: 1600 },
  // Pleine largeur : BAS depuis le profil le plus à droite (ou à gauche) y trouve une cible.
  actions: { flexDirection: "row", gap: 28, alignItems: "center", justifyContent: "center", alignSelf: "stretch", marginTop: 64 },
  dimmed: { opacity: 0.4 },
});
