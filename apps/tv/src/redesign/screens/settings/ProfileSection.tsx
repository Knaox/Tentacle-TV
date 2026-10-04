import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { OwnPinMode } from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { SectionTitle } from "./settingsParts";

/**
 * Les profils de la TV (Famille, Apple TV) : « Changer de profil » — la TV
 * quitte ce profil (sa lecture, ses listes, ses réglages ne suivent pas) et
 * revient à « Qui regarde ? » — et, pour le profil du propriétaire,
 * « Gérer les profils ». Un geste simple : rien n'est perdu, le profil se
 * rouvre depuis « Qui regarde ? ».
 *
 * Dessous, SON code PIN (propriétaire ou membre — un invité a celui que pose
 * le propriétaire) : son état, et créer, ou changer et retirer.
 *
 * Clés : `settings:switchProfile`, `settings:manageProfiles`,
 * `settings:pin:<create|change|remove>`.
 */
export const ProfileSection = memo(function ProfileSection({ canManage, pin, onSwitchProfile, onManageProfiles, onOwnPin }: {
  canManage: boolean;
  pin: { hasPin: boolean; modes: OwnPinMode[] };
  onSwitchProfile?: () => void;
  onManageProfiles?: () => void;
  onOwnPin?: (mode: OwnPinMode) => void;
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
      {pin.modes.length > 0 ? (
        <View style={styles.pin}>
          <SectionTitle title={`${t("ownPin.title")} · ${t(pin.hasPin ? "ownPin.on" : "ownPin.off")}`} caption={t("ownPin.caption")} />
          <View style={styles.actions}>
            {pin.modes.map((mode) => (
              <PillButton
                key={mode}
                label={t(`ownPin.${mode}`)}
                icon={mode === "remove" ? "close" : "lock"}
                size="md"
                focusKey={`settings:pin:${mode}`}
                onPress={onOwnPin ? () => onOwnPin(mode) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 44 },
  actions: { flexDirection: "row", gap: 22, marginTop: 8 },
  pin: { marginTop: 32 },
});
