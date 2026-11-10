/**
 * Les pièces du dialogue de téléchargement : la tuile d'une variante, la liste d'une piste, le
 * pied (taille, espace, actions) et le refus d'espace. Sorties de `DownloadDialog` pour qu'il
 * reste sous les 300 lignes ; toutes parlent les classes du socle (docs/REFONTE-UI.md).
 */

import type { ReactNode } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { GlassButton } from "../components/ui/glass/GlassButton";

/** La mise en page d'un bouton de feuille : le verre natif retire la peau (`.btn`), pas elle. */
const SHEET_BUTTON = "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap px-[18px] text-sm font-semibold";

export function VariantTile({
  selected,
  onSelect,
  label,
  description,
  hidden,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
  hidden?: boolean;
}) {
  // Invisibilité stricte : sans droit Allégé, la tuile n'est PAS rendue
  // (ni grisée, ni cadenassée).
  if (hidden) return null;
  return (
    // `ui-tile` : la tuile de choix du socle, la retenue au fond d'accent doux. `lg-choice-tile` :
    // en verre natif, un remplissage neutre, la choisie soulevée (`lgSurfaceButtons.css`).
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="ui-tile lg-choice-tile flex min-w-0 flex-1 basis-44 flex-col gap-1 p-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
    >
      <span className="text-[15px] font-semibold leading-tight text-content-primary">{label}</span>
      <span className="text-[13px] leading-snug text-content-secondary">{description}</span>
    </button>
  );
}

export function TrackSelect({
  label,
  value,
  onChange,
  emptyLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="ui-eyebrow">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Le refus d'espace du moteur (marge de sécurité comprise) : précis, et à sa place. */
export function SpaceRefusal({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-tile bg-danger-surface px-3.5 py-3 text-[13px] leading-relaxed text-status-error-fg">
      <WarningIcon size={18} weight="fill" aria-hidden className="mt-px flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}

interface FooterProps {
  /** « 4,2 Gio » — la taille de ce qui part, en chiffres à chasse fixe. */
  size: string;
  /** « Taille exacte » ou « Taille estimée ». */
  sizeCaption: string;
  /** « 184 Gio libres sur cet appareil ». */
  freeCaption: string;
  /** La taille dépasse l'espace libre : la ligne le dit avant même le refus du moteur. */
  tight: boolean;
  cancelLabel: string;
  startLabel: string;
  startIcon: ReactNode;
  startDisabled: boolean;
  onCancel: () => void;
  onStart: () => void;
}

export function DialogFooter({
  size, sizeCaption, freeCaption, tight, cancelLabel, startLabel, startIcon, startDisabled, onCancel, onStart,
}: FooterProps) {
  return (
    <div className="lg-sep flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line-subtle px-6 pb-5 pt-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5" title={`${size} · ${sizeCaption} — ${freeCaption}`}>
        <span className="num truncate text-[15px] font-semibold leading-tight text-content-primary">
          {size} <span className="text-xs font-medium text-content-tertiary">· {sizeCaption}</span>
        </span>
        <span className={`num truncate text-xs ${tight ? "text-status-error-fg" : "text-content-tertiary"}`}>{freeCaption}</span>
      </div>
      {/* Les deux actions ne se séparent jamais : à l'étroit, elles passent ENSEMBLE à la ligne. */}
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        <GlassButton
          inSurface
          onClick={onCancel}
          appearance={{ level: "regular", shape: "capsule" }}
          className={SHEET_BUTTON}
          fallbackClassName="btn btn-ghost"
        >
          {cancelLabel}
        </GlassButton>
        <GlassButton
          inSurface
          onClick={onStart}
          disabled={startDisabled}
          data-sheet-focus
          appearance={{ level: "prominent", tint: "brand", shape: "capsule" }}
          className={`${SHEET_BUTTON} disabled:opacity-45`}
          fallbackClassName="btn btn-solid"
        >
          {startIcon}
          {startLabel}
        </GlassButton>
      </div>
    </div>
  );
}

/** Les deux boutons d'une confirmation du hors ligne : la mise en page que le verre natif garde. */
export const SHEET_BUTTON_LAYOUT = SHEET_BUTTON;
