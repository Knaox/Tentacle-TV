import { useTranslation } from "react-i18next";
import { HardDriveDownload, LifeBuoy, Mail, MonitorPlay, Puzzle, Users } from "lucide-react";
import { StatTile } from "../kit";
import {
  useAccountsSummary,
  useDownloadsSummary,
  useInvitesSummary,
  usePluginsSummary,
  useSessionsSummary,
  useTicketsSummary,
} from "./overviewApi";

/**
 * Les six tuiles de la vue d'ensemble. Chacune lit SA requête : une tuile en
 * attente ou en échec n'empêche pas les autres de s'afficher. Toute la tuile
 * mène à la section où l'on agit.
 *
 * Le ton suit l'attention due, pas le contenu : trois tickets ouverts ou une
 * mise à jour de plugin passent en ambre ; des sessions en cours, en violet —
 * il se passe quelque chose, rien n'est à corriger.
 */

const ICON = 18;

/** Les morceaux de contexte présents, joints par un point médian. */
const joined = (parts: ReadonlyArray<string | false | null>) => parts.filter(Boolean).join(" · ") || undefined;

export function SessionsTile() {
  const { t } = useTranslation("admin");
  const { data, loading } = useSessionsSummary();
  const idle = data !== null && data.playing === 0 && data.groups === 0;
  return (
    <StatTile
      label={t("homeSessionsLabel")}
      icon={<MonitorPlay size={ICON} />}
      to="/admin/sessions"
      loading={loading}
      value={data?.playing}
      tone={data && data.playing > 0 ? "brand" : "default"}
      hint={
        data === null
          ? t("homeUnavailable")
          : idle
            ? t("homeSessionsNone")
            : joined([
                data.paused > 0 && t("homeSessionsPaused", { count: data.paused }),
                data.groups > 0 && t("homeSessionsGroups", { count: data.groups }),
              ])
      }
    />
  );
}

export function TicketsTile() {
  const { t } = useTranslation("admin");
  const { data, loading } = useTicketsSummary();
  const open = data?.open ?? null;
  return (
    <StatTile
      label={t("homeTicketsLabel")}
      icon={<LifeBuoy size={ICON} />}
      to="/admin/tickets"
      loading={loading}
      value={open}
      tone={open !== null && open > 0 ? "warning" : "default"}
      hint={
        data === null || open === null
          ? t("homeUnavailable")
          : data.inProgress > 0
            ? t("homeTicketsInProgress", { count: data.inProgress })
            : open === 0
              ? t("homeTicketsNone")
              : undefined
      }
    />
  );
}

export function PluginsTile() {
  const { t } = useTranslation("admin");
  const { data, loading, catalogFailed } = usePluginsSummary();
  const attention = data !== null && ((data.updates ?? 0) > 0 || data.restartRequired > 0);
  return (
    <StatTile
      label={t("homePluginsLabel")}
      icon={<Puzzle size={ICON} />}
      to="/admin/plugins"
      loading={loading}
      value={data?.updates}
      tone={attention ? "warning" : "default"}
      hint={
        data === null
          ? t("homeUnavailable")
          : joined([
              data.restartRequired > 0 && t("homePluginsRestart"),
              catalogFailed ? t("homePluginsCatalogError") : t("homePluginsInstalled", { count: data.installed }),
            ])
      }
    />
  );
}

export function AccountsTile() {
  const { t } = useTranslation("admin");
  const { data, loading } = useAccountsSummary();
  return (
    <StatTile
      label={t("homeAccountsLabel")}
      icon={<Users size={ICON} />}
      to="/admin/users"
      loading={loading}
      value={data?.total}
      hint={
        data === null
          ? t("homeUnavailable")
          : joined([
              t("homeAccountsAdmins", { count: data.admins }),
              data.disabled > 0 && t("homeAccountsDisabled", { count: data.disabled }),
            ])
      }
    />
  );
}

export function InvitesTile() {
  const { t } = useTranslation("admin");
  const { data, loading } = useInvitesSummary();
  return (
    <StatTile
      label={t("homeInvitesLabel")}
      icon={<Mail size={ICON} />}
      to="/admin/invites"
      loading={loading}
      value={data?.active}
      hint={
        data === null
          ? t("homeUnavailable")
          : data.active > 0
            ? t("homeInvitesSeats", { count: data.seatsLeft })
            : t("homeInvitesNone")
      }
    />
  );
}

export function DownloadsTile() {
  const { t } = useTranslation("admin");
  const { data, loading } = useDownloadsSummary();
  return (
    <StatTile
      label={t("homeDownloadsLabel")}
      icon={<HardDriveDownload size={ICON} />}
      to="/admin/downloads"
      loading={loading}
      value={data?.allowed}
      hint={data === null ? t("homeUnavailable") : t("homeDownloadsOf", { count: data.total })}
    />
  );
}
