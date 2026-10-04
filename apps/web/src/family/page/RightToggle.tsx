import { memo } from "react";
import { Check } from "lucide-react";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

interface RightToggleProps {
  label: string;
  hint: string;
  checked: boolean;
  /** Le propriétaire règle le droit ; les autres le LISENT seulement. */
  editable: boolean;
  pending?: boolean;
  onChange?: (next: boolean) => void;
}

/**
 * Un droit d'un profil de la Famille, sous sa ligne : « Peut créer des
 * invités » pour un membre, « Peut demander des films » pour un invité.
 * Le propriétaire l'allume ou l'éteint ; un membre voit seulement les droits
 * accordés (une coche et le libellé), jamais un interrupteur qu'il ne
 * pourrait pas actionner. Le serveur reste seul juge : l'état affiché est
 * celui qu'il rend.
 */
export const RightToggle = memo(function RightToggle({ label, hint, checked, editable, pending, onChange }: RightToggleProps) {
  if (!editable) {
    if (!checked) return null;
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-content-tertiary">
        <Check size={12} aria-hidden="true" className="text-[var(--brand-light)]" />
        {label}
      </p>
    );
  }
  return (
    <div className="mt-2 flex items-start justify-between gap-3 rounded-lg bg-fill-subtle px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-content-primary">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">{hint}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={(next) => onChange?.(next)} label={label} disabled={pending} />
    </div>
  );
});
