import { memo, type ReactNode } from "react";
import { CalendarCheck, Flame, Popcorn, Trophy } from "lucide-react";
import type { ViewingStatsRecords } from "@tentacle-tv/shared";
import { StatsSection } from "./StatsSection";
import { useStatsFormat } from "./useStatsFormat";

interface RecordCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}

const RecordCard = memo(function RecordCard({ icon, label, value, detail }: RecordCardProps) {
  return (
    <li className="flex min-w-0 items-start gap-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill-soft text-[var(--brand-light)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-content-tertiary">{label}</span>
        <span className="mt-0.5 block text-xl font-bold leading-tight text-content-primary">{value}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-content-secondary">{detail}</span>
      </span>
    </li>
  );
});

/**
 * Vos records de la période : la journée la plus remplie, la plus longue
 * suite de jours (un quart d'heure par jour au moins), le marathon (le plus
 * de TEMPS sur une série en un jour) et la plus longue séance. Un record
 * absent (trop peu de données, rien de mesuré) n'a pas de place ; aucun, pas
 * de section.
 */
export const RecordsGrid = memo(function RecordsGrid({ records }: { records: ViewingStatsRecords }) {
  const f = useStatsFormat();
  const cards: RecordCardProps[] = [];
  const { biggestDay, longestStreak, binge, longestSession } = records;
  if (biggestDay && biggestDay.seconds >= 60) {
    cards.push({
      icon: <Trophy size={18} />,
      label: f.t("record_biggestDay"),
      value: f.duration(biggestDay.seconds),
      detail: f.day(biggestDay.date, true),
    });
  }
  if (longestStreak && longestStreak.days >= 2) {
    cards.push({
      icon: <CalendarCheck size={18} />,
      label: f.t("record_longestStreak"),
      value: f.t("recordDetail_longestStreak", { count: longestStreak.days }),
      // Au mois (page publique), une série tenue dans un seul mois se dit une fois.
      detail: longestStreak.from === longestStreak.to
        ? f.day(longestStreak.to, true)
        : `${f.day(longestStreak.from)} → ${f.day(longestStreak.to, true)}`,
    });
  }
  if (binge && binge.seconds > 0) {
    cards.push({
      icon: <Flame size={18} />,
      label: f.t("record_binge"),
      value: f.duration(binge.seconds),
      detail: f.t("recordBingeDetail", { series: binge.seriesName, episodes: binge.episodes, date: f.day(binge.date, true) }),
    });
  }
  if (longestSession && longestSession.seconds >= 60) {
    cards.push({
      icon: <Popcorn size={18} />,
      label: f.t("record_longestSession"),
      value: f.duration(longestSession.seconds),
      detail: f.t("recordSessionDetail", { title: longestSession.title, date: f.day(longestSession.date, true) }),
    });
  }
  if (cards.length === 0) return null;

  return (
    <StatsSection title={f.t("recordsTitle")}>
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => <RecordCard key={c.label} {...c} />)}
      </ul>
    </StatsSection>
  );
});
