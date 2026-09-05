import { Place, type Animated, type Placed } from "./Place";

interface FauxToggleProps extends Placed, Animated {
  on: boolean;
  label?: string;
}

/**
 * L'interrupteur des réglages, en faux : les classes réelles de
 * `theme/controls.css` (`.ctl-switch`, allumé par `aria-checked`) sur un span
 * décoratif — le pouce se déplace en transform, le dégradé se révèle en opacité.
 */
export function FauxToggle({ on, label, ...place }: FauxToggleProps) {
  return (
    <Place {...place}>
      <span className="flex items-center gap-3">
        {label && <span className="whitespace-nowrap text-[12px] font-medium text-content-secondary">{label}</span>}
        <span className="ctl-switch relative inline-block h-6 w-11" aria-checked={on}>
          <span className="ctl-switch-thumb" />
        </span>
      </span>
    </Place>
  );
}
