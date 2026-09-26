import { useTranslation } from "react-i18next";
import { Activity, MonitorSmartphone, Users } from "lucide-react";
import type { PairedDevice } from "@tentacle-tv/api-client";
import { StatTile } from "../kit";
import { countActiveSince, normalizeUserId, type AdminUser } from "./userListModel";

const DAY_MS = 24 * 60 * 60 * 1000;

interface UsersSummaryProps {
  users: AdminUser[] | undefined;
  devices: PairedDevice[] | undefined;
  devicesFailed: boolean;
  /** L'heure de la dernière relève des comptes. */
  now: number;
}

/**
 * Le serveur d'un coup d'œil : combien de comptes, combien sont venus cette
 * semaine, combien d'appareils jumelés. Rien de tout cela ne se voyait avant.
 * Masqué sur téléphone — les compteurs des filtres y suffisent, et trois
 * tuiles empilées repousseraient la liste sous la ligne de flottaison.
 */
export function UsersSummary({ users, devices, devicesFailed, now }: UsersSummaryProps) {
  const { t } = useTranslation("admin");
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  const admins = users?.filter((user) => user.isAdministrator).length ?? 0;
  const activeWeek = users ? countActiveSince(users, now - 7 * DAY_MS) : undefined;
  const activeToday = users ? countActiveSince(users, midnight.getTime()) : 0;
  const accountsWithDevices = devices ? new Set(devices.map((d) => normalizeUserId(d.jellyfinUserId))).size : 0;

  return (
    <div className="hidden gap-3 sm:grid sm:grid-cols-3">
      <StatTile
        label={t("usersStatAccounts")}
        value={users?.length}
        hint={users ? t("usersStatAdmins", { count: admins }) : undefined}
        icon={<Users size={18} />}
        loading={!users}
      />
      <StatTile
        label={t("usersStatActive")}
        value={activeWeek}
        hint={users ? t("usersStatActiveToday", { count: activeToday }) : undefined}
        icon={<Activity size={18} />}
        tone="brand"
        loading={!users}
      />
      <StatTile
        label={t("pairedDevices")}
        value={devices?.length}
        hint={devicesFailed ? t("userDevicesError") : devices ? t("usersStatDevices", { count: accountsWithDevices }) : undefined}
        icon={<MonitorSmartphone size={18} />}
        loading={!devices && !devicesFailed}
      />
    </div>
  );
}
