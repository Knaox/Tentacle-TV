import { memo, type RefObject } from "react";
import { Check, Clock, Lock } from "lucide-react";
import type { SeasonPickRow, SeasonPickTone } from "@tentacle-tv/shared";

/**
 * Les lignes de la feuille des saisons (`seasonPick`, le modèle commun) : une
 * saison qui se demande se COCHE — une vraie case, au clavier comme à la
 * souris, la ligne entière pour cible ; une saison qui ne se demande pas dit
 * où elle en est, d'un glyphe ET d'un mot (« Dans la bibliothèque »,
 * « Demandée »), jamais de la couleur seule.
 */

const STATUS: Record<SeasonPickTone, { pill: string; Glyph: typeof Check }> = {
  ready: { pill: "bg-status-success-bg text-status-success-fg", Glyph: Check },
  pending: { pill: "bg-status-info-bg text-status-info-fg", Glyph: Clock },
  neutral: { pill: "bg-fill-medium text-content-secondary", Glyph: Lock },
};

function SettledRow({ row }: { row: SeasonPickRow }) {
  const status = row.status ?? { label: "", tone: "neutral" as const };
  const { pill, Glyph } = STATUS[status.tone];
  return (
    <li className="flex min-h-[52px] items-center gap-3 rounded-xl px-3">
      <span className="min-w-0 flex-1 truncate text-sm text-content-tertiary">{row.label}</span>
      {status.label !== "" && (
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${pill}`}>
          <Glyph className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
          {status.label}
        </span>
      )}
    </li>
  );
}

function CheckRow({ row, onToggle, inputRef }: {
  row: SeasonPickRow;
  onToggle: (number: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <li>
      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-3 transition-colors hover:bg-fill-soft has-[:focus-visible]:bg-fill-soft">
        <input
          ref={inputRef}
          type="checkbox"
          className="peer sr-only"
          checked={row.selected}
          onChange={() => onToggle(row.number)}
        />
        <span
          aria-hidden
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-line-focus ${
            row.selected
              ? "border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg"
              : "border-line-strong bg-fill-subtle"
          }`}
        >
          {row.selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">{row.label}</span>
        {row.detail && <span className="shrink-0 text-xs tabular-nums text-content-tertiary">{row.detail}</span>}
      </label>
    </li>
  );
}

export const SeasonRows = memo(function SeasonRows({ rows, onToggle, firstRef }: {
  rows: readonly SeasonPickRow[];
  onToggle: (number: number) => void;
  /** La première saison à cocher : l'entrée du clavier. */
  firstRef: RefObject<HTMLInputElement | null>;
}) {
  const first = rows.find((row) => !row.status)?.number;
  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((row) =>
        row.status ? (
          <SettledRow key={row.number} row={row} />
        ) : (
          <CheckRow key={row.number} row={row} onToggle={onToggle} inputRef={row.number === first ? firstRef : undefined} />
        ),
      )}
    </ul>
  );
});
