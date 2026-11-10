/**
 * L'espace du disque, en une ligne et une barre : ce que les titres occupent, ce qui reste
 * libre. À l'ENCRE — l'espace ne transfère rien ; le dégradé de jauge est réservé au lot.
 */

import { useTranslation } from "react-i18next";
import { formatBytes } from "../presets";
import { OfflineGauge } from "./OfflineGauge";

interface Props {
  usedBytes: number | null;
  freeBytes: number | null;
  className?: string;
}

export function SpaceMeter({ usedBytes, freeBytes, className = "" }: Props) {
  const { t } = useTranslation("downloads");
  const used = usedBytes ?? 0;
  const total = used + (freeBytes ?? 0);
  const ratio = total > 0 ? Math.min(1, used / total) : 0;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <span className="text-content-primary">
          {t("legendTitles")} · <span className="num font-semibold">{formatBytes(used)}</span>
        </span>
        {freeBytes !== null && (
          <span className="text-content-tertiary">
            {t("legendFree")} · <span className="num">{formatBytes(freeBytes)}</span>
          </span>
        )}
      </div>
      {/* Un trait minimal reste visible dès le premier octet. */}
      <OfflineGauge ratio={used > 0 ? Math.max(ratio, 0.01) : 0} label={t("spaceTitle")} role="meter" tone="ink" size="md" />
    </div>
  );
}
