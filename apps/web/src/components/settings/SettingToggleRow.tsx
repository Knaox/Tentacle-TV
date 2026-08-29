import { ToggleSwitch } from "./ToggleSwitch";

interface SettingToggleRowProps {
  title: string;
  hint?: string;
  active: boolean;
  onChange: (active: boolean) => void;
}

/**
 * Un réglage tout ou rien : son titre, son explication, son interrupteur.
 *
 * La forme était recopiée dans chaque bascule des Préférences ; elle vit ici
 * pour que les réglages de lecture — qui en alignent six — restent lisibles.
 */
export function SettingToggleRow({ title, hint, active, onChange }: SettingToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-content-primary">{title}</p>
        {hint !== undefined && (
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{hint}</p>
        )}
      </div>
      <ToggleSwitch checked={active} onChange={onChange} label={title} />
    </div>
  );
}

/** Le champ des Préférences : même bordure et même fond que les `<select>`. */
export const SETTING_FIELD =
  "appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary";
