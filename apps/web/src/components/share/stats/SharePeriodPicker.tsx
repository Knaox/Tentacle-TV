import { useRef, type KeyboardEvent } from "react";
import { VIEWING_STATS_PERIODS, type ViewingStatsPeriod } from "@tentacle-tv/shared";

interface Props {
  value: ViewingStatsPeriod;
  onChange: (period: ViewingStatsPeriod) => void;
  label: string;
  labelOf: (period: ViewingStatsPeriod) => string;
}

/**
 * La période d'un partage : trois choix de largeur égale, qui tiennent dans le
 * panneau jusqu'au plus petit téléphone (un libellé long passe à la ligne) et
 * se touchent au doigt (44 px). Un vrai groupe radio : tabulation sur le seul
 * choix actif, flèches pour changer — comme le contrôle segmenté des barres
 * d'outils. Le choix actif prend le dégradé de marque en fondu d'opacité,
 * sans couleur animée.
 */
export function SharePeriodPicker({ value, onChange, label, labelOf }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, VIEWING_STATS_PERIODS.indexOf(value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (current + step + VIEWING_STATS_PERIODS.length) % VIEWING_STATS_PERIODS.length;
    onChange(VIEWING_STATS_PERIODS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 gap-1 rounded-xl bg-[color:var(--surface-2)] p-1 ring-1 ring-line-strong"
    >
      {VIEWING_STATS_PERIODS.map((period, i) => {
        const selected = period === value;
        return (
          <button
            key={period}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(period)}
            className={`relative isolate flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-xs font-semibold leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)] ${
              selected ? "text-cta-brand-fg" : "text-content-secondary hover:text-content-primary"
            }`}
          >
            <span
              aria-hidden
              className={`absolute inset-0 -z-10 rounded-lg transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0"}`}
              style={{
                background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))",
                boxShadow: "0 2px 10px rgba(var(--brand-rgb),0.35)",
              }}
            />
            {labelOf(period)}
          </button>
        );
      })}
    </div>
  );
}
