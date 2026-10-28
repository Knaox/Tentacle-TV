/** Octave (mobile) — une ligne de réglage à interrupteur, pastille « Octave seulement ». */

import { BrandSwitch, SettingsRow } from "@/components/settings";

interface SwitchRowProps {
  icon: "unlock" | "droplet" | "refresh-cw" | "shuffle";
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  last?: boolean;
}

/** Une ligne à interrupteur, pastille « Octave seulement » : toute la ligne bascule (cible ≥ 44 pt). */
export function SwitchRow({ icon, label, description, value, onChange, last }: SwitchRowProps) {
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      scope="octave"
      onPress={() => onChange(!value)}
      trailing={<BrandSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />}
      last={last}
    />
  );
}
