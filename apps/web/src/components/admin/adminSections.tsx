import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  HardDriveDownload,
  LifeBuoy,
  Mail,
  MonitorPlay,
  Puzzle,
  Server,
  Users,
} from "lucide-react";
import type { SettingsShellSection } from "@tentacle-tv/ui";

/**
 * Les sections de l'administration, dans l'ordre du rail de la coquille.
 *
 * Trois groupes, dans l'ordre où l'on s'en sert : ce qui se passe (Activité),
 * qui a accès (Comptes), ce qui fait tourner le serveur (Serveur).
 *
 * Les libellés sont des clés `nav*` propres au rail : les titres de pages
 * appartiennent aux pages, qui peuvent les reformuler sans toucher au rail.
 */

const ICON = 17;

export function useAdminSections(): SettingsShellSection[] {
  const { t } = useTranslation("admin");
  return useMemo(() => {
    const activity = t("groupActivity");
    const accounts = t("groupAccounts");
    const server = t("groupServer");
    return [
      { id: "sessions", label: t("navSessions"), icon: <MonitorPlay size={ICON} />, group: activity },
      { id: "tickets", label: t("navTickets"), icon: <LifeBuoy size={ICON} />, group: activity },
      { id: "users", label: t("navUsers"), icon: <Users size={ICON} />, group: accounts },
      { id: "invites", label: t("navInvites"), icon: <Mail size={ICON} />, group: accounts },
      { id: "downloads", label: t("navDownloads"), icon: <HardDriveDownload size={ICON} />, group: accounts },
      { id: "services", label: t("navServices"), icon: <Server size={ICON} />, group: server },
      { id: "metadata", label: t("navMetadata"), icon: <Database size={ICON} />, group: server },
      { id: "plugins", label: t("navPlugins"), icon: <Puzzle size={ICON} />, group: server },
    ];
  }, [t]);
}

/** La route d'une section. */
export function adminSectionPath(id: string): string {
  return `/admin/${id}`;
}

/**
 * La section active d'après l'adresse. On ne retient que le premier segment
 * après `/admin` : `/admin/plugins/<id>` (l'écran d'un plugin) garde
 * « Plugins » allumé dans le rail. `null` sur l'index.
 */
export function activeAdminSection(pathname: string): string | null {
  const rest = pathname.replace(/^\/admin\/?/, "");
  return rest.split("/")[0] || null;
}
