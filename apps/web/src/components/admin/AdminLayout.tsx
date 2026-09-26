import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SettingsShell } from "@tentacle-tv/ui";

import { getUserInfo } from "../userMenu/menuItems";
import { OVERVIEW_ID, activeAdminSection, adminSectionPath, useAdminSections } from "./adminSections";

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
 * Le rail range les sections en trois groupes (`adminSections.tsx`) et s'ouvre
 * sur la vue d'ensemble — l'index `/admin`, qui était un panneau VIDE sur
 * desktop. Chaque page porte son en-tête (`AdminPage`, components/admin/kit) :
 * la coquille n'en affiche aucun, elle ne fait que nommer le rail.
 *
 * Pleine largeur sur desktop, toutes sections confondues : le rail à gauche,
 * le reste de l'écran au contenu. Ce qui doit rester étroit (un formulaire, une
 * phrase) se borne lui-même.
 *
 * Sous `md`, la vue d'ensemble EST l'écran d'atterrissage (tuiles + liste des
 * sections) : le rail n'y est pas montré, et le retour n'existe qu'à
 * l'intérieur d'une section — il ramène à la vue d'ensemble, sans boucle.
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
        onBack={activeId === OVERVIEW_ID ? undefined : () => navigate("/admin")}
        backLabel={t("navOverview")}
        fluid
      >
        <Outlet />
      </SettingsShell>
    </div>
  );
}
