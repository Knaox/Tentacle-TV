import { SettingsRow, type SettingsIcon } from "./SettingsRow";

export interface SettingsOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  icon?: SettingsIcon;
}

interface Props<V extends string> {
  options: ReadonlyArray<SettingsOption<V>>;
  value: V;
  onChange: (value: V) => void;
  /** La dernière option ferme la carte (pas de hairline). Défaut : vrai. */
  closesCard?: boolean;
}

/**
 * Un choix unique dont chaque option a besoin d'une phrase : des lignes à
 * coche, dans la carte de la section. La description reste lisible en
 * entier, ce qu'un segmenté ne permet pas.
 */
export function SettingsOptionList<V extends string>({ options, value, onChange, closesCard = true }: Props<V>) {
  return (
    <>
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
    </>
  );
}
