import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Database,
  HardDriveDownload,
  LifeBuoy,
  Mail,
  Palette,
  Puzzle,
  Server,
  Users,
} from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";

import { getUserInfo } from "../userMenu/menuItems";

/**
 * Coquille maître-détail de l'administration.
 *
 * Remplace la pile de 6 cartes pleine largeur qui demandait plusieurs écrans de
 * défilement pour un contenu tenant dans un seul, et dont chaque carte
 * n'apportait qu'un titre, une phrase et un bouton « Gérer les X » redondant
 * avec son propre titre.
 *
 * Route PARENTE : les URLs existantes (`/admin/users`, `/admin/theme/tokens`…)
 * sont inchangées, elles deviennent simplement des enfants. Aucun lien profond
 * ne casse, y compris les routes dynamiques des plugins.
 */

const ICON_SIZE = 17;

export function AdminLayout() {
  const { t } = useTranslation("admin");
  const { t: tTheme } = useTranslation("adminTheme");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = getUserInfo();

  const sections = useMemo<SettingsShellSection[]>(
    () => [
      { id: "users", label: t("usersTitle"), icon: <Users size={ICON_SIZE} /> },
      { id: "downloads", label: t("downloadsTitle"), icon: <HardDriveDownload size={ICON_SIZE} /> },
      { id: "invites", label: t("invitesTitle"), icon: <Mail size={ICON_SIZE} /> },
      { id: "tickets", label: t("supportTickets"), icon: <LifeBuoy size={ICON_SIZE} /> },
      { id: "plugins", label: t("pluginsTitle"), icon: <Puzzle size={ICON_SIZE} /> },
      { id: "services", label: t("services"), icon: <Server size={ICON_SIZE} /> },
      { id: "metadata", label: t("metadataTitle"), icon: <Database size={ICON_SIZE} /> },
      { id: "theme", label: tTheme("adminCardTitle"), icon: <Palette size={ICON_SIZE} /> },
    ],
    [t, tTheme],
  );

  // `/admin/theme/tokens` doit garder « theme » actif dans le rail : on ne
  // retient que le premier segment après /admin.
  const activeId = useMemo(() => {
    const rest = pathname.replace(/^\/admin\/?/, "");
    if (!rest) return null;
    return rest.split("/")[0] || null;
  }, [pathname]);

  const active = sections.find((s) => s.id === activeId);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="pt-6">
      <SettingsShell
        sections={sections}
        activeId={activeId}
        onSelect={(id) => navigate(`/admin/${id}`)}
        /* En-tête affiché UNIQUEMENT sur l'index : chaque page admin porte déjà
           son propre <h1>. Les unifier demanderait de les retoucher une par une
           — à faire dans une passe dédiée, pas au milieu du changement de
           structure de navigation. */
        title={active ? undefined : t("title")}
        description={active ? undefined : t("overviewDescription")}
        onBack={() => navigate("/admin")}
        backLabel={t("title")}
      >
        <Outlet />
      </SettingsShell>
    </div>
  );
}
