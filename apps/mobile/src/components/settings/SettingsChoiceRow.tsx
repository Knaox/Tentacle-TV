import { SegmentedChoice, type ChoiceOption } from "./SegmentedChoice";
import { SettingsRow, type SettingsIcon } from "./SettingsRow";

interface Props {
  icon?: SettingsIcon;
  label: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}

/**
 * Un choix entre deux ou trois mots courts (langue, thème, densité) : une
 * ligne ordinaire dont le contrôle segmenté COMPACT tient à droite. Jamais un
 * pavé pleine largeur pour « Français / Anglais ». Les choix longs ou
 * expliqués passent par `SettingsOptionList` ou `SettingsPickerRow`.
 */
export function SettingsChoiceRow({ icon, label, options, value, onChange, last }: Props) {
  return (
    <SettingsRow
      icon={icon}
      label={label}
      last={last}
      trailing={
        <SegmentedChoice compact options={options} value={value} onChange={onChange} accessibilityLabel={label} />
      }
    />
  );
}
