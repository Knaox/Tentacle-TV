import { ToggleSwitch } from "./ToggleSwitch";

interface SettingToggleRowProps {
  titre: string;
  aide?: string;
  actif: boolean;
  onChange: (actif: boolean) => void;
}

/**
 * Un réglage tout ou rien : son titre, son explication, son interrupteur.
 *
 * La forme était recopiée dans chaque bascule des Préférences ; elle vit ici
 * pour que les réglages de lecture — qui en alignent six — restent lisibles.
 */
export function SettingToggleRow({ titre, aide, actif, onChange }: SettingToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-content-primary">{titre}</p>
        {aide !== undefined && (
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{aide}</p>
        )}
      </div>
      <ToggleSwitch checked={actif} onChange={onChange} label={titre} />
    </div>
  );
}

/** Le champ des Préférences : même bordure et même fond que les `<select>`. */
export const CHAMP_REGLAGE =
  "appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary";
