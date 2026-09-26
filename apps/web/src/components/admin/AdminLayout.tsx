import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SettingsShell } from "@tentacle-tv/ui";

import { getUserInfo } from "../userMenu/menuItems";
import { activeAdminSection, adminSectionPath, useAdminSections } from "./adminSections";

/**
 * Coquille maître-détail de l'administration.
 *
 * Remplace la pile de 6 cartes pleine largeur qui demandait plusieurs écrans de
 * défilement pour un contenu tenant dans un seul, et dont chaque carte
 * n'apportait qu'un titre, une phrase et un bouton « Gérer les X » redondant
 * avec son propre titre.
 *
 * Route PARENTE : les URLs existantes (`/admin/users`, `/admin/plugins/<id>`…)
 * sont inchangées, elles deviennent simplement des enfants. Aucun lien profond
 * ne casse, y compris les routes dynamiques des plugins.
 *
 * Le rail range les sections en trois groupes (`adminSections.tsx`). Chaque
 * page porte son en-tête : la coquille n'en affiche un que sur l'index.
 *
 * Pleine largeur sur desktop, toutes sections confondues : le rail à gauche,
 * le reste de l'écran au contenu. Ce qui doit rester étroit (un formulaire, une
 * phrase) se borne lui-même.
 */
export function AdminLayout() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = getUserInfo();
  const sections = useAdminSections();
  const activeId = useMemo(() => activeAdminSection(pathname), [pathname]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="pt-6">
      <SettingsShell
        sections={sections}
        activeId={activeId}
        onSelect={(id) => navigate(adminSectionPath(id))}
        navLabel={t("title")}
        title={activeId ? undefined : t("title")}
        description={activeId ? undefined : t("overviewDescription")}
        onBack={() => navigate("/admin")}
        backLabel={t("title")}
        fluid
      >
        <Outlet />
      </SettingsShell>
    </div>
  );
}
