import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import type { ViewingStatsPeriod } from "@tentacle-tv/shared";
import { ShareStatsModal } from "./ShareStatsModal";

/**
 * « Partager » sur la page « Vos statistiques » — au ton de « Partager ma
 * liste » (aplat violet, liseré et texte de marque, sans le dégradé plein de
 * l'action principale). Il ouvre le panneau plutôt que la feuille du système :
 * un partage de statistiques se règle (la période) et se lit (ce qui devient
 * public) avant d'exister. 36 px de haut, une cible de 44 px au doigt.
 */
export function ShareStatsButton({ period }: { period: ViewingStatsPeriod }) {
  const { t } = useTranslation("statsShare");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("title")}
        className="relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-rgb),0.16),rgba(var(--brand-rgb),0.16))] px-4 text-sm font-semibold text-[var(--brand-light)] shadow-[var(--elev-1)] ring-1 ring-[rgba(var(--brand-rgb),0.5)] transition-colors before:absolute before:-inset-1 before:content-[''] hover:text-content-primary hover:ring-[rgba(var(--brand-rgb),0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
      >
        <Share2 aria-hidden className="h-4 w-4" />
        {t("button")}
      </button>
      {open && <ShareStatsModal defaultPeriod={period} onClose={() => setOpen(false)} />}
    </>
  );
}
