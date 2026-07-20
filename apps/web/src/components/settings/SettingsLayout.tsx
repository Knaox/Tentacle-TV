import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HardDriveDownload, Palette, Play, ShieldCheck } from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";

import { useIsMobile } from "../../hooks/useIsMobile";
import { useDownloadsVisibility } from "../../downloads/useDownloadState";
import { useOfflineMode } from "../../offline/useOfflineMode";

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

/**
 * Index de `/settings`. Sur desktop l'index n'affichait qu'un titre au-dessus
 * d'un panneau vide — on redirige vers Apparence, la premiere section. Sur
 * mobile on garde le rail comme ecran d'atterrissage : rediriger ici ferait
 * BOUCLER le bouton Retour (Retour -> /settings -> redirection -> la meme page).
 */
export function SettingsIndex() {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <Navigate to="/settings/appearance" replace />;
}

export function SettingsLayout() {
  const { t } = useTranslation("preferences");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Desktop uniquement, et seulement avec le droit Jellyfin OU du contenu
  // local déjà présent — sinon la section n'existe pas (invisibilité stricte).
  const { visible: downloadsVisible } = useDownloadsVisibility();
  // Hors ligne : la section Sécurité (mot de passe, appareils, serveur)
  // n'a aucun sens sans serveur — non rendue.
  const offline = useOfflineMode();

  const sections = useMemo<SettingsShellSection[]>(
    () => [
      { id: "appearance", label: t("sectionAppearance"), icon: <Palette size={ICON} /> },
      ...(offline
        ? []
        : [{ id: "security", label: t("sectionSecurity"), icon: <ShieldCheck size={ICON} /> }]),
      { id: "playback", label: t("sectionPlayback"), icon: <Play size={ICON} /> },
      ...(downloadsVisible
        ? [{ id: "downloads", label: t("sectionDownloads"), icon: <HardDriveDownload size={ICON} /> }]
        : []),
    ],
    [t, downloadsVisible, offline],
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
        /* Le titre generique n'apparait que sur l'atterrissage mobile (le rail).
           `t("title")` = « Preferences de langues » etait faux comme ombrelle :
           c'est le titre historique de la seule page Lecture. */
        title={active ? active.label : t("settingsTitle")}
        description={undefined}
        onBack={() => navigate("/settings")}
        backLabel={t("back")}
      >
        <Outlet />
      </SettingsShell>
    </div>
  );
}
