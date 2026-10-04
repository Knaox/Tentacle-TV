import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PillButton } from "../../controls/PillButton";
import { SectionTitle } from "./settingsParts";

/**
 * Les profils de la TV (Famille, Apple TV) : « Changer de profil » — la TV
 * quitte ce profil (sa lecture, ses listes, ses réglages ne suivent pas) et
 * revient à « Qui regarde ? » — et, pour le profil du propriétaire,
 * « Gérer les profils ». Un geste simple : rien n'est perdu, le profil se
 * rouvre depuis « Qui regarde ? ».
 *
 * Clés : `settings:switchProfile`, `settings:manageProfiles`.
 */
export const ProfileSection = memo(function ProfileSection({ canManage, onSwitchProfile, onManageProfiles }: {
  canManage: boolean;
  onSwitchProfile?: () => void;
  onManageProfiles?: () => void;
}) {
  const { t } = useTranslation("familyTv");
  return (
    <View style={styles.section}>
      <SectionTitle title={t("settings.profilesTitle")} caption={t("settings.switchCaption")} />
      <View style={styles.actions}>
        <PillButton label={t("settings.switchProfile")} icon="user" variant="primary" size="md" focusKey="settings:switchProfile" onPress={onSwitchProfile} />
        {canManage ? (
          <PillButton label={t("manageProfiles")} icon="settings" size="md" focusKey="settings:manageProfiles" onPress={onManageProfiles} />
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 44 },
  actions: { flexDirection: "row", gap: 22, marginTop: 8 },
});
