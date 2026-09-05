import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { Place, type Animated, type Placed } from "./Place";

interface FauxToggleProps extends Placed, Animated {
  on: boolean;
  label?: string;
}

const noop = () => {};

/** L'interrupteur des réglages, le vrai (`ToggleSwitch`), inerte : c'est la scène qui bascule. */
export function FauxToggle({ on, label, ...place }: FauxToggleProps) {
  return (
    <Place {...place}>
      <span className="flex items-center gap-3">
        {label && <span className="whitespace-nowrap text-sm text-content-primary">{label}</span>}
        <ToggleSwitch checked={on} onChange={noop} label={label ?? ""} />
      </span>
    </Place>
  );
}
