import { memo, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceAxis, type ViewingStatsTimeline } from "@tentacle-tv/shared";
import { ChartTooltip } from "./ChartTooltip";
import { ActivityTable, ChartLegend } from "./ActivityParts";
import { useElementWidth } from "./useElementWidth";
import { useStatsFormat } from "./useStatsFormat";

const PLOT_H = 180;
const TOP = 22;
const AXIS_H = 26;
const LEFT = 40;
const RIGHT = 6;
const LABEL_SPACING = 30;

export const MEASURED_COLOR = "var(--brand)";
export const MEASURED_ACTIVE = "var(--brand-light)";
export const ESTIMATED_COLOR = "rgba(var(--brand-rgb), 0.38)";

/** Une colonne : carrée à la base, 4 px arrondis au bout de la donnée seulement. */
function columnPath(x: number, w: number, yTop: number, yBottom: number, rounded: boolean): string {
  const h = yBottom - yTop;
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  if (r <= 0) return `M${x},${yBottom}V${yTop}H${x + w}V${yBottom}Z`;
  return `M${x},${yBottom}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBottom}Z`;
}

/**
 * La frise d'activité : des colonnes (heures par jour, mois ou année), le
 * mesuré à la base, l'estimé posé dessus, séparés par un filet de 2 px de la
 * couleur du fond. Une seule échelle, graduations rondes, grille en traits
 * fins. Le survol — ou les flèches, le graphique ayant le focus — désigne une
 * colonne et ouvre son infobulle ; la plus haute porte sa valeur en clair.
 */
export const ActivityChart = memo(function ActivityChart({ timeline }: { timeline: ViewingStatsTimeline }) {
  const f = useStatsFormat();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const { buckets, unit } = timeline;
  const n = buckets.length;

  const model = useMemo(() => {
    const totals = buckets.map((b) => b.measuredSeconds + b.estimatedSeconds);
    const maxSeconds = Math.max(0, ...totals);
    const axis = niceAxis(maxSeconds / 3600);
    const peak = maxSeconds > 0 ? totals.indexOf(maxSeconds) : -1;
    return {
      totals, axis, peak,
      hasMeasured: buckets.some((b) => b.measuredSeconds > 0),
      hasEstimated: buckets.some((b) => b.estimatedSeconds > 0),
    };
  }, [buckets]);

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const band = n > 0 ? plotW / n : 0;
  const barW = Math.min(24, Math.max(3, band * 0.62));
  const yOf = (seconds: number) => TOP + PLOT_H - (seconds / 3600 / model.axis.max) * PLOT_H;
  const labelEvery = Math.max(1, Math.ceil(LABEL_SPACING / Math.max(band, 1)));

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left - LEFT;
    const i = Math.floor(x / band);
    setActive(i >= 0 && i < n ? i : null);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setActive((cur) => Math.max(0, Math.min(n - 1, (cur ?? n - 1) + moves[e.key])));
  };

  const activeBucket = active !== null ? buckets[active] : null;
  const summary = model.peak >= 0
    ? f.t("activityPeak", { duration: f.duration(model.totals[model.peak]), label: f.bucket(unit, buckets[model.peak].key) })
    : f.t(`activityHint_${unit}`);

  return (
    <div>
      {model.hasMeasured && model.hasEstimated && (
        <ChartLegend
          items={[
            { color: MEASURED_COLOR, label: f.t("legendMeasured") },
            { color: ESTIMATED_COLOR, label: f.t("legendEstimated") },
          ]}
        />
      )}
      <div
        ref={ref}
        className="relative mt-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        tabIndex={0}
        role="group"
        aria-label={`${f.t(`activityHint_${unit}`)}. ${summary}`}
        onKeyDown={onKey}
        onFocus={() => setActive((cur) => cur ?? (model.peak >= 0 ? model.peak : n - 1))}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={TOP + PLOT_H + AXIS_H} onPointerMove={onPointer} onPointerLeave={() => setActive(null)} aria-hidden>
            {model.axis.ticks.map((tick) => {
              const y = TOP + PLOT_H - (tick / model.axis.max) * PLOT_H;
              return (
                <g key={tick}>
                  <line x1={LEFT} x2={width - RIGHT} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} />
                  <text x={LEFT - 8} y={y + 4} textAnchor="end" className="fill-content-tertiary text-[11px] tabular-nums">
                    {`${f.number(tick, tick % 1 === 0 ? 0 : 1)} h`}
                  </text>
                </g>
              );
            })}
            {buckets.map((b, i) => {
              const x = LEFT + band * i + (band - barW) / 2;
              const base = TOP + PLOT_H;
              const measuredTop = yOf(b.measuredSeconds);
              const both = b.measuredSeconds > 0 && b.estimatedSeconds > 0;
              const estimatedBottom = both ? measuredTop - 2 : base;
              const estimatedTop = estimatedBottom - (b.estimatedSeconds / 3600 / model.axis.max) * PLOT_H;
              const isActive = active === i;
              return (
                <g key={b.key}>
                  {b.measuredSeconds > 0 && (
                    <path d={columnPath(x, barW, measuredTop, base, !both)} fill={isActive ? MEASURED_ACTIVE : MEASURED_COLOR} />
                  )}
                  {b.estimatedSeconds > 0 && estimatedTop < estimatedBottom && (
                    <path d={columnPath(x, barW, estimatedTop, estimatedBottom, true)} fill={ESTIMATED_COLOR} opacity={isActive ? 1 : 0.9} />
                  )}
                  {(i === n - 1 || (n - 1 - i) % labelEvery === 0) && (
                    <text x={LEFT + band * (i + 0.5)} y={TOP + PLOT_H + 17} textAnchor="middle" className="fill-content-tertiary text-[11px]">
                      {f.tick(unit, b.key)}
                    </text>
                  )}
                </g>
              );
            })}
            {model.peak >= 0 && active === null && (
              <text
                x={LEFT + band * (model.peak + 0.5)}
                y={Math.max(12, yOf(model.totals[model.peak]) - 7)}
                textAnchor="middle"
                className="fill-content-primary text-[11px] font-semibold tabular-nums"
              >
                {f.duration(model.totals[model.peak])}
              </text>
            )}
          </svg>
        )}
        {activeBucket && active !== null && (
          <ChartTooltip
            x={LEFT + band * (active + 0.5)}
            y={yOf(model.totals[active]) - 10}
            containerWidth={width}
            headline={model.totals[active] > 0 ? f.duration(model.totals[active]) : f.t("noViewing")}
            title={f.bucket(unit, activeBucket.key)}
            rows={model.hasMeasured && model.hasEstimated && model.totals[active] > 0 ? [
              { color: MEASURED_COLOR, label: f.t("legendMeasured"), value: f.duration(activeBucket.measuredSeconds) },
              { color: ESTIMATED_COLOR, label: f.t("legendEstimated"), value: f.duration(activeBucket.estimatedSeconds) },
            ] : undefined}
          />
        )}
      </div>
      {timeline.undatedSeconds > 0 && (
        <p className="mt-3 text-xs text-content-tertiary">{f.t("activityUndated", { duration: f.duration(timeline.undatedSeconds) })}</p>
      )}
      <ActivityTable timeline={timeline} />
    </div>
  );
});
