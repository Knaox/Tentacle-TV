import { SubSetting } from "./SubSetting";
import { ToggleSwitch } from "./ToggleSwitch";

interface SettingToggleRowProps {
  title: string;
  hint?: string;
  active: boolean;
  onChange: (active: boolean) => void;
  /** Grisé : le réglage existe mais ne s'applique pas ici (son explication dit pourquoi). */
  disabled?: boolean;
}

/**
 * Un réglage tout ou rien, à l'intérieur d'une ligne : son titre, son explication, son
 * interrupteur (`SubSetting`). Les réglages de lecture en alignent six.
 */
export function SettingToggleRow({ title, hint, active, onChange, disabled }: SettingToggleRowProps) {
  return (
    <SubSetting
      title={title}
      hint={hint}
      disabled={disabled}
      trailing={<ToggleSwitch checked={active} onChange={onChange} label={title} disabled={disabled} />}
    />
  );
}

/** Le champ des Préférences : le champ du socle (40 px, rayon de 10, anneau de focus à la teinte franche). */
export const SETTING_FIELD = "field [&>option]:bg-surface-2 [&>option]:text-content-primary";
