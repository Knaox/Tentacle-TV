import { memo, type RefObject } from "react";
import { CheckIcon as Check } from "@phosphor-icons/react/dist/csr/Check";
import { ClockIcon as Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { LockIcon as Lock } from "@phosphor-icons/react/dist/csr/Lock";
import type { SeasonPickRow, SeasonPickTone } from "@tentacle-tv/shared";

/**
 * Les lignes de la feuille des saisons (`seasonPick`, le modèle commun) : une
 * saison qui se demande se COCHE — une vraie case, au clavier comme à la
 * souris, la ligne entière pour cible ; une saison qui ne se demande pas dit
 * où elle en est, d'un glyphe ET d'un mot (« Dans la bibliothèque »,
 * « Demandée »), jamais de la couleur seule.
 */

/** La puce du socle (`.chip`), à la teinte de l'état. */
const STATUS: Record<SeasonPickTone, { pill: string; Glyph: typeof Check }> = {
  ready: { pill: "chip-success", Glyph: Check },
  pending: { pill: "bg-status-info-bg text-status-info-fg", Glyph: Clock },
  neutral: { pill: "", Glyph: Lock },
};

function SettledRow({ row }: { row: SeasonPickRow }) {
  const status = row.status ?? { label: "", tone: "neutral" as const };
  const { pill, Glyph } = STATUS[status.tone];
  return (
    <li className="flex min-h-[48px] items-center gap-3 rounded-field px-3">
      <span className="min-w-0 flex-1 truncate text-sm text-content-tertiary">{row.label}</span>
      {status.label !== "" && (
        <span className={`chip shrink-0 ${pill}`}>
          <Glyph weight="bold" className="h-3 w-3" aria-hidden />
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
      <label className="group relative z-0 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-field px-3">
        <input
          ref={inputRef}
          type="checkbox"
          className="peer sr-only"
          checked={row.selected}
          onChange={() => onToggle(row.number)}
        />
        {/* Le fond de la ligne, au survol comme au focus clavier : un calque
            FRÈRE de la case (`peer`), jamais `:has()` — le client LG compile ce
            CSS, et son socle Chrome 53 perdrait la règle entière (build webOS
            refusée). En fondu d'opacité : aucune couleur animée. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-field bg-fill-soft opacity-0 transition-opacity duration-hover group-hover:opacity-100 peer-focus-visible:opacity-100"
        />
        {/* La case du socle (`.ui-check`) : cochée, l'aplat d'accent — plus de dégradé. */}
        <span
          aria-hidden
          data-checked={row.selected}
          className="ui-check peer-focus-visible:ring-2 peer-focus-visible:ring-line-focus"
        >
          <Check weight="bold" className="h-3.5 w-3.5" />
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
