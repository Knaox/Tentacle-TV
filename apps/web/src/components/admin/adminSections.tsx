import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  Globe,
  HardDriveDownload,
  HeartHandshake,
  LayoutDashboard,
  LifeBuoy,
  MonitorPlay,
  Puzzle,
  Server,
  Settings2,
  Users,
} from "lucide-react";
import type { SettingsShellSection } from "@tentacle-tv/ui";
import { useAppConfig, useServerCapabilities } from "@tentacle-tv/api-client";
import { isFamilyAvailable, type ServerCapability } from "@tentacle-tv/shared";

/**
 * Les sections de l'administration — une seule liste pour le rail de la
 * coquille ET la liste « Toutes les sections » de l'accueil sur mobile, où le
 * rail est caché.
 *
 * Quatre groupes, rangés par TÂCHE de l'administrateur (lot « Octave
 * qualité », 26/10 — le modèle de Jellyfin, Plex, Synology DSM) : ce qui se
 * passe (Activité), qui a accès (Utilisateurs et accès), ce que voient les
 * utilisateurs (Bibliothèques et lecture), ce qui fait tourner le serveur
 * (Serveur). Deux niveaux au plus : le rail, puis, dans une page, des onglets
 * (Utilisateurs : Comptes · Invitations). La vue d'ensemble ouvre le rail,
 * hors groupe.
 *
 * Les libellés sont des clés `nav*` propres au rail : les titres de pages
 * appartiennent aux pages, qui peuvent les reformuler sans toucher au rail.
 * `hint` dit en quelques mots ce que la section contient (liste mobile).
 *
 * Une section qui exige une capacité du serveur (`capability`) n'existe que
 * s'il la déclare (`serverCapabilities.ts`) : un serveur d'avant ne la montre pas.
 * « Famille » n'existe que si le serveur a la Famille (`features.family`).
 */

export const OVERVIEW_ID = "overview";
const ICON = 17;

/** Une section du rail, avec la phrase qui dit ce qu'elle contient. */
export type AdminNavSection = SettingsShellSection & { hint?: string };

type AdminSection = AdminNavSection & { capability?: ServerCapability; hidden?: boolean };

/**
 * Les adresses servies SOUS une autre section du rail : « Invitations » est un
 * onglet d'« Utilisateurs », qui reste allumé.
 */
const SECTION_OF_PATH: Readonly<Record<string, string>> = { invites: "users" };

export function useAdminSections(): AdminNavSection[] {
  const { t } = useTranslation("admin");
  const { capabilities } = useServerCapabilities();
  // L'administration est en ligne, en session personnelle : `features.family` suffit.
  const family = isFamilyAvailable(useAppConfig().data?.features.family, false);
  return useMemo(() => {
    const activity = t("groupActivity");
    const access = t("groupUsersAccess");
    const media = t("groupMedia");
    const server = t("groupServer");
    const sections: AdminSection[] = [
      { id: OVERVIEW_ID, label: t("navOverview"), icon: <LayoutDashboard size={ICON} /> },
      { id: "sessions", label: t("navSessions"), hint: t("hintSessions"), icon: <MonitorPlay size={ICON} />, group: activity },
      { id: "tickets", label: t("navTickets"), hint: t("hintTickets"), icon: <LifeBuoy size={ICON} />, group: activity },
      { id: "users", label: t("navUsers"), hint: t("hintUsers"), icon: <Users size={ICON} />, group: access },
      {
        id: "family", label: t("navFamily"), hint: t("hintFamily"), icon: <HeartHandshake size={ICON} />, group: access, hidden: !family,
      },
      { id: "downloads", label: t("navDownloads"), hint: t("hintDownloads"), icon: <HardDriveDownload size={ICON} />, group: access },
      { id: "services", label: t("navServices"), hint: t("hintServices"), icon: <Server size={ICON} />, group: media },
      { id: "metadata", label: t("navMetadata"), hint: t("hintMetadata"), icon: <Database size={ICON} />, group: media },
      {
        id: "remote-access",
        label: t("navRemoteAccess"),
        hint: t("hintRemoteAccess"),
        icon: <Globe size={ICON} />,
        group: server,
        capability: "admin.remoteAccess",
      },
      { id: "plugins", label: t("navPlugins"), hint: t("hintPlugins"), icon: <Puzzle size={ICON} />, group: server },
      { id: "system", label: t("navSystem"), hint: t("hintSystem"), icon: <Settings2 size={ICON} />, group: server },
    ];
    return sections
      .filter((section) => !section.hidden && (!section.capability || capabilities.has(section.capability)))
      .map(({ capability: _capability, hidden: _hidden, ...section }) => section);
  }, [t, capabilities, family]);
}

/** La route d'une section : la vue d'ensemble est l'index `/admin`. */
export function adminSectionPath(id: string): string {
  return id === OVERVIEW_ID ? "/admin" : `/admin/${id}`;
}

/**
 * La section active d'après l'adresse. On ne retient que le premier segment
 * après `/admin` : `/admin/plugins/<id>` (l'écran d'un plugin) garde
 * « Plugins » allumé dans le rail, `/admin/invites` garde « Utilisateurs ».
 * L'index est la vue d'ensemble.
 */
export function activeAdminSection(pathname: string): string {
  const rest = pathname.replace(/^\/admin\/?/, "");
  const first = rest.split("/")[0];
  return first ? (SECTION_OF_PATH[first] ?? first) : OVERVIEW_ID;
}
