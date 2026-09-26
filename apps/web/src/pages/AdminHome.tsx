import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Tv, UserPlus } from "lucide-react";
import { SettingsRow } from "@tentacle-tv/ui";
import { AdminPage, AdminSection } from "../components/admin/kit";
import { HealthCard } from "../components/admin/home/HealthCard";
import {
  AccountsTile,
  DownloadsTile,
  InvitesTile,
  PluginsTile,
  SessionsTile,
  TicketsTile,
} from "../components/admin/home/OverviewTiles";
import { OVERVIEW_ID, adminSectionPath, useAdminSections } from "../components/admin/adminSections";
import { cls } from "./adminUtils";

/**
 * La vue d'ensemble de l'administration — l'index `/admin`, qui n'affichait
 * rien sur desktop (un panneau vide à côté du rail).
 *
 * D'un coup d'œil : l'état de Jellyfin et de la base, ce qui se passe (les
 * sessions en direct), ce qui attend (tickets ouverts, mises à jour de
 * plugins) et l'état des accès (comptes, invitations actives, droit de
 * téléchargement). Chaque tuile mène à sa section ; les raccourcis ouvrent
 * les gestes les plus fréquents.
 *
 * Sur mobile, le rail n'est pas affiché : la liste de toutes les sections
 * clôt la page, c'est elle qui sert de navigation.
 */
export function AdminHome() {
  const { t } = useTranslation("admin");

  return (
    <AdminPage title={t("navOverview")} description={t("overviewDescription")}>
      {/* Deux colonnes dès le téléphone (une tuile se lit sur 160 px), quatre
          sur grand écran : l'état du serveur en occupe deux, en tête. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <HealthCard className="col-span-2" />
        <SessionsTile />
        <TicketsTile />
        <PluginsTile />
        <AccountsTile />
        <InvitesTile />
        <DownloadsTile />
      </div>
      <Shortcuts />
      <SectionList />
    </AdminPage>
  );
}

function Shortcuts() {
  const { t } = useTranslation("admin");
  return (
    <AdminSection title={t("homeShortcutsTitle")}>
      <div className="flex flex-wrap gap-2">
        <Shortcut to="/admin/invites" icon={<UserPlus size={16} />}>
          {t("homeShortcutInvite")}
        </Shortcut>
        <Shortcut to="/pair-device" icon={<Tv size={16} />}>
          {t("homeShortcutPair")}
        </Shortcut>
        <Shortcut to="/admin/users" icon={<Eye size={16} />}>
          {t("homeShortcutImpersonate")}
        </Shortcut>
      </div>
    </AdminSection>
  );
}

function Shortcut({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className={`${cls.bs} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}>
      <span aria-hidden="true" className="flex text-content-tertiary">
        {icon}
      </span>
      {children}
    </Link>
  );
}

/** Mobile seulement : le rail y est caché, cette liste en tient lieu. */
function SectionList() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const sections = useAdminSections().filter((section) => section.id !== OVERVIEW_ID);

  return (
    <div className="md:hidden">
      <AdminSection title={t("homeSectionsTitle")} flush>
        {sections.map((section, index) => (
          <SettingsRow
            key={section.id}
            icon={section.icon}
            label={section.label}
            onClick={() => navigate(adminSectionPath(section.id))}
            chevron
            last={index === sections.length - 1}
          />
        ))}
      </AdminSection>
    </div>
  );
}
