import { memo, useMemo, useState, type PointerEvent } from "react";
import { analyzeRhythm, heatLevel, HEAT_LEVELS, RHYTHM_HOURS } from "@tentacle-tv/shared";
import { ChartTooltip } from "./ChartTooltip";
import { RhythmTable } from "./RhythmTable";
import { useElementWidth } from "./useElementWidth";
import { useStatsFormat } from "./useStatsFormat";

/**
 * Rampe séquentielle d'une seule teinte : la marque, du plus discret au plein.
 * Sur fond sombre comme sur fond clair, la luminosité varie dans le bon sens
 * (le fond fait l'autre bout) ; la case vide garde un gris à part.
 */
const LEVEL_ALPHA = [0, 0.24, 0.46, 0.7, 1];
export const heatColor = (level: number) =>
  level === 0 ? "var(--fill-soft)" : `rgba(var(--brand-rgb), ${LEVEL_ALPHA[level]})`;

interface Hover {
  index: number;
  x: number;
  y: number;
}

/**
 * « Quand regardez-vous ? » — la grille jour × heure du temps MESURÉ, en
 * quatre niveaux d'une seule teinte, séparés par 2 px de fond. La phrase
 * au-dessus dit l'essentiel (le jour et l'heure dominants) ; l'infobulle
 * donne la valeur d'une case ; le tableau replié en dessous résume sans
 * couleur ni souris.
 */
export const RhythmHeatmap = memo(function RhythmHeatmap({ grid }: { grid: number[] }) {
  const f = useStatsFormat();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const insight = useMemo(() => analyzeRhythm(grid), [grid]);
  const max = useMemo(() => Math.max(0, ...grid), [grid]);

  if (insight.totalSeconds <= 0) {
    return <p className="rounded-xl bg-fill-faint px-4 py-6 text-center text-sm text-content-tertiary">{f.t("rhythmEmpty")}</p>;
  }

  const headline =
    insight.topWeekday !== null && insight.topHour !== null
      ? f.t("rhythmInsight", { weekday: f.weekday(insight.topWeekday), hour: insight.topHour })
      : "";
  const daypart = insight.topDaypart ? f.t("rhythmDaypart", { daypart: f.t(`daypart_${insight.topDaypart}`) }) : "";
  const hourStep = width < 480 ? 6 : 3;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!cell) return setHover(null);
    const index = Number(cell.dataset.cell);
    if (hover?.index === index) return;
    setHover({ index, x: cell.offsetLeft + cell.offsetWidth / 2, y: cell.offsetTop - 6 });
  };

  return (
    <div>
      <p className="text-base font-semibold text-content-primary">{headline}</p>
      {daypart && <p className="mt-0.5 text-sm text-content-tertiary">{daypart}</p>}

      <div
        ref={ref}
        className="relative mt-4"
        role="img"
        aria-label={`${headline}. ${daypart}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <div className="grid items-center" style={{ gridTemplateColumns: `2.5rem repeat(${RHYTHM_HOURS}, minmax(0, 1fr))`, gap: 2 }}>
          {Array.from({ length: 7 }, (_, day) => (
            <DayRow key={day} day={day} label={f.weekdayShort(day)} grid={grid} max={max} />
          ))}
          <span />
          {Array.from({ length: RHYTHM_HOURS }, (_, hour) => (
            <span key={hour} className="text-center text-[10px] tabular-nums text-content-tertiary">
              {hour % hourStep === 0 ? hour : ""}
            </span>
          ))}
        </div>
        {hover && (
          <ChartTooltip
            x={hover.x}
            y={hover.y}
            containerWidth={width}
            headline={grid[hover.index] > 0 ? f.duration(grid[hover.index]) : f.t("noViewing")}
            title={`${f.weekday(Math.floor(hover.index / RHYTHM_HOURS))}, ${hover.index % RHYTHM_HOURS} h – ${(hover.index % RHYTHM_HOURS) + 1} h`}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-content-tertiary" aria-hidden>
          {f.t("rhythmLess")}
          {Array.from({ length: HEAT_LEVELS + 1 }, (_, level) => (
            <span key={level} className="h-3 w-3 rounded-[3px]" style={{ background: heatColor(level) }} />
          ))}
          {f.t("rhythmMore")}
        </div>
        <p className="text-[11px] text-content-tertiary">{f.t("rhythmNote")}</p>
      </div>
      <RhythmTable grid={grid} />
    </div>
  );
});

const DayRow = memo(function DayRow({ day, label, grid, max }: { day: number; label: string; grid: number[]; max: number }) {
  return (
    <>
      <span className="pr-1 text-[11px] font-medium text-content-tertiary">{label}</span>
      {Array.from({ length: RHYTHM_HOURS }, (_, hour) => {
        const index = day * RHYTHM_HOURS + hour;
        return (
          <span
            key={hour}
            data-cell={index}
            className="aspect-square rounded-[3px]"
            style={{ background: heatColor(heatLevel(grid[index], max)) }}
          />
        );
      })}
    </>
  );
});
