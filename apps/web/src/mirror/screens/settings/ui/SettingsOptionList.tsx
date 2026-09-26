import type { LucideIcon } from "lucide-react";
import { SettingsRow } from "./SettingsRow";

export interface SettingsOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

/**
 * `SettingsOptionList` de l'app : un choix unique dont chaque option a besoin
 * de sa phrase — des lignes à coche dans la carte de la section.
 */
export function SettingsOptionList<V extends string>({ options, value, onChange, closesCard = true }: {
  options: ReadonlyArray<SettingsOption<V>>;
  value: V;
  onChange: (value: V) => void;
  /** La dernière option ferme la carte (pas de filet). Défaut : vrai. */
  closesCard?: boolean;
}) {
  return (
    <div role="radiogroup">
      {options.map((option, index) => (
        <SettingsRow
          key={option.value}
          icon={option.icon}
          label={option.label}
          description={option.description}
          checked={option.value === value}
          last={closesCard && index === options.length - 1}
          onPress={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
