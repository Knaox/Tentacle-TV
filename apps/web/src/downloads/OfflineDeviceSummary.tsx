/**
 * Le résumé de ce que la machine porte : combien de titres, l'espace occupé,
 * le dernier ajouté — et l'accès à la gestion des transferts.
 *
 * Il remplace le lien nu « Gérer les téléchargements » posé à côté du titre :
 * l'accueil local ne disait rien de ce qu'il contenait, alors que la base sait
 * tout. Même rôle que la carte « Sur cet appareil » du téléphone.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { formatBytes } from "./presets";
import { useDiskInfo } from "./useDownloadState";

export function OfflineDeviceSummary({ complete }: { complete: readonly DownloadListEntry[] }) {
  const { t } = useTranslation("downloads");
  const { usedBytes } = useDiskInfo();

  // Le dernier ajouté : celui dont l'entrée est la plus récente.
  const last = complete.reduce<DownloadListEntry | null>(
    (best, entry) => (best === null || entry.createdAt > best.createdAt ? entry : best),
    null,
  );
  const lastName = last === null ? null : last.kind === "episode" ? last.seriesName ?? last.title : last.title;

  const parts = [
    t("deviceTitles", { count: complete.length }),
    usedBytes === null ? null : t("deviceSpace", { size: formatBytes(usedBytes) }),
    lastName ? t("deviceLastAdded", { name: lastName }) : null,
  ].filter((part): part is string => part !== null && part !== "");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fill-faint px-4 py-3">
      <p className="min-w-0 truncate text-sm text-content-secondary">{parts.join(" · ")}</p>
      <Link
        to="/downloads"
        className="flex-shrink-0 rounded-md bg-fill-subtle px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
      >
        {t("offlineManage")}
      </Link>
    </div>
  );
}
