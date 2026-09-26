import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CircleHelp, ExternalLink, Info, Lock, LogOut, Server, Shield, Trash2, UserX } from "lucide-react";
import { isDesktopApp } from "../../../desktop/bridge";
import { SettingsRow } from "../settings/ui/SettingsRow";
import { SettingsSection } from "../settings/ui/SettingsSection";
import type { PaneContext } from "../settings/panes";
import { ProfilePaneRow } from "./ProfilePaneRow";
import type { ProfileActions } from "./useProfileActions";

const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

/**
 * `ProfileAccountSections` de l'app : Aide, Connexion, Compte, Zone de
 * danger, puis la version (11, quaternaire, centrée). « Changer de serveur »
 * n'existe que dans l'application de bureau (dans un navigateur, le serveur
 * EST l'adresse) ; « Passer hors ligne » n'existe pas dans le navigateur.
 */
export function ProfileAccountSections({ ctx, actions, serverUrl, version }: {
  ctx: PaneContext;
  actions: ProfileActions;
  serverUrl: string;
  version: string;
}) {
  const { t } = useTranslation("profile");
  const { t: to } = useTranslation("offline");
  const navigate = useNavigate();
  const { offline } = ctx;
  const canChangeServer = !offline && isDesktopApp();

  return (
    <>
      <SettingsSection title={t("help")}>
        {!offline && <SettingsRow icon={CircleHelp} label={t("support")} chevron onPress={() => navigate("/support")} />}
        <SettingsRow icon={Info} label={t("about")} chevron onPress={() => navigate("/about")} />
        <SettingsRow
          icon={Shield}
          label={t("privacyPolicy")}
          // L'icône « sortie » dit que la page s'ouvre hors de l'app.
          trailing={<ExternalLink size={16} className="shrink-0 pl-1 text-content-quaternary" aria-hidden />}
          last
          onPress={() => window.open(PRIVACY_POLICY_URL, "_blank", "noopener,noreferrer")}
        />
      </SettingsSection>

      {canChangeServer && (
        <SettingsSection title={to("sectionConnection")}>
          <SettingsRow icon={Server} label={t("changeServer")} description={serverUrl || undefined} chevron last onPress={actions.askChangeServer} />
        </SettingsSection>
      )}

      <SettingsSection title={t("account")}>
        {!offline && <ProfilePaneRow pane="password" icon={Lock} label={t("password")} />}
        <SettingsRow icon={LogOut} label={t("logout")} destructive last onPress={actions.handleLogout} />
      </SettingsSection>

      {!offline && (
        <SettingsSection title={t("dangerZone")}>
          <SettingsRow icon={Trash2} label={t("clearCache")} destructive onPress={actions.askClearCache} />
          <SettingsRow icon={UserX} label={t("deleteAccount")} destructive last disabled={actions.busy} onPress={actions.askDeleteAccount} />
        </SettingsSection>
      )}

      <p className="mt-2 text-center text-[11px] text-content-quaternary">{t("version", { version })}</p>
    </>
  );
}
