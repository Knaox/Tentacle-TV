import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Palette, Play, ShieldCheck } from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";

/**
 * Coquille des réglages utilisateur.
 *
 * `/settings` était une colonne à plat : langue, puis UNE CARTE PAR
 * bibliothèque Jellyfin, puis — tout en bas — le mot de passe, les appareils
 * jumelés et le changement de serveur. Autrement dit, la profondeur de
 * défilement pour atteindre son mot de passe dépendait du nombre de
 * bibliothèques de l'instance.
 *
 * Même coquille que l'administration, donc même grammaire de navigation entre
 * les deux écrans de configuration.
 */

const ICON = 17;

export function SettingsLayout() {
  const { t } = useTranslation("preferences");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const sections = useMemo<SettingsShellSection[]>(
    () => [
      { id: "appearance", label: t("sectionAppearance"), icon: <Palette size={ICON} /> },
      { id: "security", label: t("sectionSecurity"), icon: <ShieldCheck size={ICON} /> },
      { id: "playback", label: t("sectionPlayback"), icon: <Play size={ICON} /> },
    ],
    [t],
  );

  const activeId = useMemo(() => {
    const rest = pathname.replace(/^\/settings\/?/, "");
    return rest.split("/")[0] || null;
  }, [pathname]);

  const active = sections.find((s) => s.id === activeId);

  return (
    <div className="pt-6">
      <SettingsShell
        sections={sections}
        activeId={activeId}
        onSelect={(id) => navigate(`/settings/${id}`)}
        title={active ? active.label : t("title")}
        description={active ? undefined : t("subtitle")}
        onBack={() => navigate("/settings")}
        backLabel={t("back")}
      >
        <Outlet />
      </SettingsShell>
    </div>
  );
}
