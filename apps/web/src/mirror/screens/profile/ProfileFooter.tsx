import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, LogOut } from "lucide-react";
import { SettingsRow } from "../settings/ui/SettingsRow";
import { SettingsSection } from "../settings/ui/SettingsSection";

/**
 * « Mes statistiques », sous l'identité : un écran plein, pas une rubrique du
 * catalogue — ce qu'on vient regarder, pas régler. Absent hors ligne.
 */
export function ProfileStatsCard({ offline }: { offline: boolean }) {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  if (offline) return null;
  return (
    <SettingsSection>
      <SettingsRow icon={BarChart3} label={t("stats")} description={t("statsHint")} accent chevron last onPress={() => navigate("/stats")} />
    </SettingsSection>
  );
}

/**
 * Le bas de la liste : « Se déconnecter », seul dans sa carte et après les
 * rubriques (on le touche, jamais par mégarde), puis la version.
 */
export function ProfileFooter({ onLogout, version }: { onLogout: () => void; version: string }) {
  const { t } = useTranslation("profile");
  return (
    <>
      <SettingsSection>
        <SettingsRow icon={LogOut} label={t("logout")} destructive last onPress={onLogout} />
      </SettingsSection>
      <p className="mt-2 text-center text-[11px] text-content-quaternary">{t("version", { version })}</p>
    </>
  );
}
