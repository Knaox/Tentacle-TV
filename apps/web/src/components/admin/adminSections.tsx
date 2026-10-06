import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  Globe,
  HardDriveDownload,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MonitorPlay,
  Puzzle,
  Server,
  Users,
} from "lucide-react";
import type { SettingsShellSection } from "@tentacle-tv/ui";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { ServerCapability } from "@tentacle-tv/shared";

/**
 * Les sections de l'administration — une seule liste pour le rail de la
 * coquille ET la liste « Toutes les sections » de l'accueil sur mobile, où le
 * rail est caché.
 *
 * Trois groupes, dans l'ordre où l'on s'en sert : ce qui se passe (Activité),
 * qui a accès (Comptes), ce qui fait tourner le serveur (Serveur). La vue
 * d'ensemble ouvre le rail, hors groupe.
 *
 * Les libellés sont des clés `nav*` propres au rail : les titres de pages
 * appartiennent aux pages, qui peuvent les reformuler sans toucher au rail.
 *
 * Une section qui exige une capacité du serveur (`capability`) n'existe que
 * s'il la déclare (`serverCapabilities.ts`) : un serveur d'avant ne la montre pas.
 */

export const OVERVIEW_ID = "overview";
const ICON = 17;

type AdminSection = SettingsShellSection & { capability?: ServerCapability };

export function useAdminSections(): SettingsShellSection[] {
  const { t } = useTranslation("admin");
  const { capabilities } = useServerCapabilities();
  return useMemo(() => {
    const activity = t("groupActivity");
    const accounts = t("groupAccounts");
    const server = t("groupServer");
    const sections: AdminSection[] = [
      { id: OVERVIEW_ID, label: t("navOverview"), icon: <LayoutDashboard size={ICON} /> },
      { id: "sessions", label: t("navSessions"), icon: <MonitorPlay size={ICON} />, group: activity },
      { id: "tickets", label: t("navTickets"), icon: <LifeBuoy size={ICON} />, group: activity },
      { id: "users", label: t("navUsers"), icon: <Users size={ICON} />, group: accounts },
      { id: "invites", label: t("navInvites"), icon: <Mail size={ICON} />, group: accounts },
      { id: "downloads", label: t("navDownloads"), icon: <HardDriveDownload size={ICON} />, group: accounts },
      { id: "services", label: t("navServices"), icon: <Server size={ICON} />, group: server },
      {
        id: "remote-access", label: t("navRemoteAccess"), icon: <Globe size={ICON} />, group: server, capability: "admin.remoteAccess",
      },
      { id: "metadata", label: t("navMetadata"), icon: <Database size={ICON} />, group: server },
      { id: "plugins", label: t("navPlugins"), icon: <Puzzle size={ICON} />, group: server },
    ];
    return sections
      .filter((section) => !section.capability || capabilities.has(section.capability))
      .map(({ capability: _capability, ...section }) => section);
  }, [t, capabilities]);
}

/** La route d'une section : la vue d'ensemble est l'index `/admin`. */
export function adminSectionPath(id: string): string {
  return id === OVERVIEW_ID ? "/admin" : `/admin/${id}`;
}

/**
 * La section active d'après l'adresse. On ne retient que le premier segment
 * après `/admin` : `/admin/plugins/<id>` (l'écran d'un plugin) garde
 * « Plugins » allumé dans le rail. L'index est la vue d'ensemble.
 */
export function activeAdminSection(pathname: string): string {
  const rest = pathname.replace(/^\/admin\/?/, "");
  return rest.split("/")[0] || OVERVIEW_ID;
}
