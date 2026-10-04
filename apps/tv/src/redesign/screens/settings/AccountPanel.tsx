import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { confirmBlur, confirmPress } from "@tentacle-tv/tv-core";
import { Icon } from "../../icons/Icon";
import { colors, text, white } from "../../theme/tokens";
import { ConfirmPill } from "./ConfirmPill";
import { ProfileSection } from "./ProfileSection";
import { Avatar, InfoRow, SectionTitle, settingsText } from "./settingsParts";
import type { AccountAction, SettingsAccount } from "./settingsTypes";

/**
 * L'onglet Compte : qui regarde (portrait, nom), où (serveur, appareil), et
 * comment cesser de l'être — « Changer de serveur » et « Déjumeler cet
 * appareil », à DOUBLE appui : le premier arme (« Confirmer — … »,
 * « Confirmer le déjumelage »), le second exécute, et quitter le bouton
 * désarme. Pas de boîte de dialogue : à la télécommande, il faudrait y
 * retrouver le bouton d'annulation. Le déjumelage garde l'action et la clé
 * de focus `logout` de l'ancienne « Déconnexion ».
 *
 * L'état armé est un état d'AFFICHAGE, local à la vue ; `initialArmed` le
 * pose à l'ouverture (banc). Branchement : `useAccountActions`, deux
 * déjumelages complets (`unpairDevice`) — le changement de serveur oublie en
 * plus l'adresse.
 *
 * Apple TV passée aux profils (Famille, `account.profile`) : le profil ouvert
 * et son rôle, « Changer de profil » et « Gérer les profils »
 * (`ProfileSection`) ; « Changer de serveur » s'efface — il passe par un
 * déjumelage — et « Déjumeler » n'appartient qu'au profil du propriétaire.
 */

export interface AccountPanelProps {
  account: SettingsAccount;
  initialArmed?: AccountAction | null;
  onChangeServer?: () => void;
  onLogout?: () => void;
  onSwitchProfile?: () => void;
  onManageProfiles?: () => void;
}

export const AccountPanel = memo(function AccountPanel(props: AccountPanelProps) {
  const { account, initialArmed = null, onChangeServer, onLogout } = props;
  const { t } = useTranslation(["pairing", "nav", "common", "preferences", "familyTv"]);
  const profile = account.profile ?? null;
  const [armed, setArmed] = useState<AccountAction | null>(initialArmed);

  // Le double appui : la règle de tv-core (`panels/confirmPress`).
  const press = useCallback((action: AccountAction) => {
    const step = confirmPress(armed, action);
    setArmed(step.armed);
    if (step.run) (action === "logout" ? onLogout : onChangeServer)?.();
  }, [armed, onChangeServer, onLogout]);

  const leave = useCallback((action: AccountAction) => (focused: boolean) => {
    if (!focused) setArmed((current) => confirmBlur(current, action));
  }, []);

  const confirm = (label: string) => `${t("common:confirm")} — ${label}`;

  return (
    <View>
      <View style={styles.profile}>
        <Avatar uri={account.avatarUri} name={account.name} size={168} />
        <View style={styles.identity}>
          <Text style={text.kicker}>{profile ? t("familyTv:settings.kicker") : t("pairing:tvCompteJumele")}</Text>
          <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
          {profile ? <Text style={settingsText.hint}>{profile.role}</Text> : null}
        </View>
      </View>

      <View style={styles.infos}>
        <InfoRow icon="server" label={t("pairing:tvServeur")} value={account.serverUrl} />
        <InfoRow icon="tv" label={t("pairing:tvPlateforme")} value={account.deviceLabel} />
      </View>

      {profile ? (
        <ProfileSection canManage={profile.canManage} onSwitchProfile={props.onSwitchProfile} onManageProfiles={props.onManageProfiles} />
      ) : null}

      <View style={styles.forget}>
        <SectionTitle title={t("pairing:tvOublierTitre")} caption={profile?.unpairNote ?? t("pairing:tvUnpairCaption")} />
        {profile?.unpairNote ? null : (
          <View style={styles.actions}>
            {profile ? null : (
              <ConfirmPill
                label={t("nav:changeServer")}
                icon="server"
                armed={armed === "changeServer"}
                armedLabel={confirm(t("nav:changeServer"))}
                focusKey="settings:changeServer"
                onPress={() => press("changeServer")}
                onFocusChange={leave("changeServer")}
              />
            )}
            <ConfirmPill
              label={t("pairing:tvUnpairDevice")}
              icon="logout"
              tone="danger"
              armed={armed === "logout"}
              armedLabel={t("pairing:tvUnpairConfirm")}
              focusKey="settings:logout"
              onPress={() => press("logout")}
              onFocusChange={leave("logout")}
            />
          </View>
        )}
        <View style={[styles.armedHint, { opacity: armed ? 1 : 0 }]}>
          <Icon name="alert" size={26} color={colors.accent} strokeWidth={2.4} />
          <Text style={[settingsText.hint, styles.armedText]}>
            {armed === "logout" ? t("pairing:tvUnpairHint") : t("preferences:tvPressAgainToConfirm")}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 40 },
  identity: { flex: 1, gap: 10 },
  name: { ...text.title, fontSize: 64, lineHeight: 72 },
  infos: {
    marginTop: 44,
    paddingVertical: 22,
    gap: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: white(0.1),
  },
  forget: { marginTop: 44 },
  actions: { flexDirection: "row", gap: 22, marginTop: 8 },
  armedHint: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 26 },
  armedText: { color: colors.accentLight },
});
