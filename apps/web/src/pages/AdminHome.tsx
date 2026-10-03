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
import { AttentionPanel } from "../components/admin/attention/AttentionPanel";
import { AttentionStatus } from "../components/admin/attention/AttentionStatus";
import { useAdminAttention } from "../components/admin/attention/useAdminAttention";
import { JellyfinCompatSection } from "../components/admin/jellyfin/JellyfinCompatSection";
import { RecommendedPluginsSection } from "../components/admin/recommended/RecommendedPluginsSection";
import { ServerUpdateCard } from "../components/admin/serverUpdate/ServerUpdateCard";
import { cls } from "./adminUtils";

/** Ce qui rend Jellyfin inutilisable : tant que l'une de ces entrées est à régler, ce qui en dépend se tait. */
const JELLYFIN_DOWN = new Set(["jellyfinNotConfigured", "jellyfinUnreachable", "jellyfinKeyRejected"]);

/**
 * La vue d'ensemble de l'administration — l'index `/admin`.
 *
 * En tête, l'état en UNE ligne (« Tout fonctionne », « 1 point à régler ·
 * 3 recommandations »), puis deux familles, dans cet ordre : À RÉGLER
 * (jamais masquable) et RECOMMANDATIONS (masquables par compte). Chaque
 * entrée : un titre, une phrase, une action, le détail replié — jamais une
 * pile de bandeaux qui répètent la même cause : tant que Jellyfin n'est pas
 * utilisable, ce qui en dépend se tait.
 *
 * Puis l'état (le serveur Tentacle, toujours visible, et sa mise à jour ;
 * Jellyfin et la base), l'activité (sessions, tickets, plugins, comptes,
 * invitations, téléchargements), la compatibilité de Jellyfin et les
 * extensions recommandées. La liste complète des réglages de Jellyfin et
 * des liens du serveur vit dans Services.
 *
 * Sur mobile, le rail n'est pas affiché : la liste de toutes les sections
 * clôt la page, c'est elle qui sert de navigation.
 */
export function AdminHome() {
  const { t } = useTranslation("admin");
  const { attention, context } = useAdminAttention();
  const jellyfinDown = attention.blocking.some((entry) => JELLYFIN_DOWN.has(entry.id));

  return (
    <AdminPage
      title={t("navOverview")}
      description={t("overviewDescription")}
      summary={<AttentionStatus attention={attention} servicesFailed={context.servicesFailed} />}
    >
      <AttentionPanel attention={attention} context={context} />
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <ServerUpdateCard />
        <HealthCard />
      </div>
      {/* Deux colonnes dès le téléphone (une tuile se lit sur 160 px), trois sur grand écran. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <SessionsTile />
        <TicketsTile />
        <PluginsTile />
        <AccountsTile />
        <InvitesTile />
        <DownloadsTile />
      </div>
      {jellyfinDown ? null : <JellyfinCompatSection variant="overview" />}
      <RecommendedPluginsSection />
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
