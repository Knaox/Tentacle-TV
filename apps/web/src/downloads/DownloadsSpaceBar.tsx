/**
 * Jauge d'espace de l'écran Téléchargements : occupé par les téléchargements
 * vs espace libre du volume. Barre en tokens (piste fill-soft, remplissage
 * brand) — mêmes familles que les barres de progression de lecture.
 */

import { useTranslation } from "react-i18next";
import { formatBytes } from "./presets";
import { useDiskInfo } from "./useDownloadState";

export function DownloadsSpaceBar() {
  const { t } = useTranslation("downloads");
  const { freeBytes, usedBytes } = useDiskInfo();

  const total = (usedBytes ?? 0) + (freeBytes ?? 0);
  const usedPct = total > 0 ? Math.min(100, ((usedBytes ?? 0) / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-line-subtle bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-tertiary">
        <span>{t("spaceUsed", { size: formatBytes(usedBytes) })}</span>
        <span>{t("freeSpace", { size: formatBytes(freeBytes) })}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-soft">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}
