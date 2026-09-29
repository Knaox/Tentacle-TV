import { memo } from "react";
import { CalendarRange } from "lucide-react";
import type { ViewingStatsPeriod } from "@tentacle-tv/shared";
import { TentacleLogo } from "../../ui/TentacleLogo";
import { useStatsFormat } from "../../stats/useStatsFormat";

interface Props {
  period: ViewingStatsPeriod;
  /** Le jour du calcul (midi UTC), dit au jour. */
  generatedAt: string;
}

/**
 * L'en-tête des statistiques partagées, à la manière d'une liste partagée :
 * la marque (on sait d'où vient le lien), un surtitre au point de marque, le
 * titre qui nomme l'auteur, puis la période partagée — dite en toutes
 * lettres, jamais à choisir — et la promesse de lecture seule.
 */
export const SharedStatsHeader = memo(function SharedStatsHeader({ period, generatedAt }: Props) {
  const f = useStatsFormat();
  return (
    <header className="min-w-0 animate-fade-slide-up">
      <TentacleLogo size="sm" wordmark wordmarkText="Tentacle TV" />
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">
        <span
          aria-hidden
          className="mr-2 inline-block h-1.5 w-1.5 -translate-y-px rounded-full align-middle"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        />
        {f.t("kicker")}
      </p>
      <h1 className="mt-2 break-words text-3xl font-extrabold tracking-tight text-content-primary md:text-5xl">{f.t("title")}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-content-secondary md:text-base">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange size={16} aria-hidden className="text-[var(--brand-light)]" />
          {f.t(`periodNote_${period}`)}
        </span>
        <span aria-hidden className="text-content-tertiary">·</span>
        <span className="tabular-nums">{f.t("updated", { date: f.isoDay(generatedAt, true) })}</span>
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-tertiary">{f.t("readOnlyNote")}</p>
    </header>
  );
});
