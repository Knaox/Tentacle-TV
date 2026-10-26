import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChangePasswordSection } from "../../components/preferences/ChangePasswordSection";
import { MyDevicesSection } from "../../components/settings/MyDevicesSection";
import { ChangeServerSection } from "../../components/settings/ChangeServerSection";
import { LinkedAccounts } from "../../components/settings/personalization/LinkedAccounts";
import { SettingItem } from "../../components/settings/wide/SettingItem";
import { WideGroup } from "../../components/settings/wide/WideGroup";
import { SETTING_BUTTON, SETTING_DANGER_BUTTON } from "../../components/settings/wide/settingButtons";
import { useWideSettingVisible } from "../../components/settings/wide/wideSettingsMeta";
import { getUserInfo } from "../../components/userMenu/menuItems";
import { ProfileConfirmDialog } from "../../mirror/screens/profile/ProfileConfirmDialog";
import { useProfileActions } from "../../mirror/screens/profile/useProfileActions";

/**
 * Réglages › Compte et sécurité — ce qui touche le COMPTE (mot de passe,
 * appareils jumelés, comptes liés, suppression), puis ce qui ne touche que
 * CET appareil (changer de serveur, vider le cache). Chaque ligne n'existe
 * que si le serveur la permet à cette session (`account.abilities`) : une
 * session de profil de la Famille n'a ni mot de passe, ni appareils, ni
 * suppression, mais garde ses comptes liés et le cache.
 *
 * « Vider le cache » et « Supprimer mon compte » n'existaient que sur le
 * téléphone et le web étroit : les gestes (et leurs confirmations) sont ceux
 * du profil de l'app (`useProfileActions`), jamais une copie.
 */
export function SettingsSecurity() {
  const { t } = useTranslation(["pairing", "profile"]);
  const actions = useProfileActions(getUserInfo().isAdmin);
  const passwordVisible = useWideSettingVisible("password");
  const devicesVisible = useWideSettingVisible("pairedDevices");
  const linkedVisible = useWideSettingVisible("linkedAccounts");

  return (
    <div className="max-w-2xl">
      <WideGroup section="security" group="signIn">
        {passwordVisible && (
          <SettingItem setting="password">
            <ChangePasswordSection embedded />
          </SettingItem>
        )}
        {devicesVisible && (
          <SettingItem
            setting="pairedDevices"
            trailing={<Link to="/pair-device" className={SETTING_BUTTON}>{t("pairing:pairDevice")}</Link>}
          >
            <MyDevicesSection embedded />
          </SettingItem>
        )}
      </WideGroup>

      <WideGroup section="security" group="linked">
        {linkedVisible && <LinkedAccounts />}
      </WideGroup>

      <WideGroup section="security" group="thisDevice">
        <ChangeServerSection />
        <SettingItem
          setting="clearCache"
          trailing={(
            <button type="button" onClick={actions.askClearCache} className={SETTING_BUTTON}>
              {t("profile:clearCacheConfirm")}
            </button>
          )}
        />
      </WideGroup>

      <WideGroup section="security" group="danger">
        <SettingItem
          setting="deleteAccount"
          destructive
          trailing={(
            <button type="button" onClick={actions.askDeleteAccount} disabled={actions.busy} className={SETTING_DANGER_BUTTON}>
              {t("profile:deleteAccountConfirm")}
            </button>
          )}
        />
      </WideGroup>

      <ProfileConfirmDialog actions={actions} />
    </div>
  );
}
