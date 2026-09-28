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
    <li className="flex items-start gap-3 rounded-2xl bg-fill-faint p-4 ring-1 ring-line-subtle">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: "linear-gradient(135deg, var(--brand-light), var(--brand-accent))" }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-content-tertiary">{label}</span>
        <span className="mt-0.5 block text-xl font-bold text-content-primary">{value}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-content-secondary">{detail}</span>
      </span>
    </li>
  );
});

/**
 * Vos records de la période : la journée la plus remplie, la plus longue
 * suite de jours, le marathon, la plus longue séance. Un record absent (trop
 * peu de données, rien de mesuré) n'a pas de carte ; aucun, pas de section.
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
      detail: `${f.day(longestStreak.from)} → ${f.day(longestStreak.to, true)}`,
    });
  }
  if (binge) {
    cards.push({
      icon: <Flame size={18} />,
      label: f.t("record_binge"),
      value: f.t("seriesEpisodes", { count: binge.episodes }),
      detail: f.t("recordBingeDetail", { series: binge.seriesName, date: f.day(binge.date, true) }),
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
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => <RecordCard key={c.label} {...c} />)}
      </ul>
    </StatsSection>
  );
});
