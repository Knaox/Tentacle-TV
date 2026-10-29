/**
 * Octave — la pastille « Importé » d'une sortie importée par le compte (`imported`, musicReleases.ts) : discrète,
 * icône ET mot (jamais la seule couleur), l'infobulle dit d'où elle vient. `overlay` : au coin d'une pochette de
 * carte, sur un fond plein ; `inline` : dans la ligne de tête d'un album ou d'un artiste.
 */

import { HardDriveUpload } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ImportedBadge({ variant }: { variant: "overlay" | "inline" }) {
  const { t } = useTranslation("musicReleases");
  if (variant === "overlay") {
    return (
      <span title={t("badgeHint")} className="pointer-events-none absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/70 px-2 text-[11px] font-semibold leading-none text-white shadow-[var(--oc-shadow-art)]">
        <HardDriveUpload className="h-3.5 w-3.5" aria-hidden />
        {t("badge")}
      </span>
    );
  }
  return (
    <span title={t("badgeHint")} className="inline-flex h-6 items-center gap-1 rounded-full border border-line-subtle px-2 text-xs font-semibold text-content-secondary">
      <HardDriveUpload className="h-3.5 w-3.5" aria-hidden />
      {t("badge")}
    </span>
  );
}
