import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

interface StayOnDeviceToggleProps {
  checked: boolean;
  /** Pendant l'entrée dans un profil : plus rien ne se coche (la case s'efface). */
  disabled: boolean;
  onToggle: () => void;
}

/**
 * « Ne plus proposer sur cet appareil » — la case DISCRÈTE sous les profils,
 * jumelle de `StayToggle` de l'Apple TV : au repos ni fond ni verre, une case
 * et un libellé en retrait ; au survol, le fond léger des boutons secondaires
 * (d'un coup : aucune couleur animée, règle « Coût GPU » 3). Une vraie case à
 * cocher (Tab, Espace), cible de 44 px de haut, anneau de focus sur la case.
 * Cochée, elle se remplit de la couleur de marque et la phrase dessous dit ce
 * qui va se passer et comment en revenir — sa place est RÉSERVÉE, rien ne
 * saute quand elle paraît.
 */
export const StayOnDeviceToggle = memo(function StayOnDeviceToggle({ checked, disabled, onToggle }: StayOnDeviceToggleProps) {
  const { t } = useTranslation("profilePicker");
  const hintId = useId();
  return (
    <div className={`flex flex-col items-center transition-opacity duration-200 ${disabled ? "pointer-events-none opacity-0" : ""}`}>
      <label className="inline-flex h-11 cursor-pointer select-none items-center gap-3 rounded-full px-4 text-sm font-medium text-content-secondary hover:bg-fill-soft hover:text-content-primary">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-describedby={checked ? hintId : undefined}
        />
        <span
          aria-hidden
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-line-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-0 ${
            checked ? "border-transparent bg-[var(--brand)]" : "border-line-strong"
          }`}
        >
          <Check size={14} strokeWidth={3} className={`text-white transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`} />
        </span>
        {t("stayOnDevice")}
      </label>
      <p id={hintId} aria-live="polite" className="mt-1 min-h-[2.5rem] max-w-sm text-center text-xs leading-5 text-content-tertiary">
        {checked ? t("stayOnDeviceHint") : ""}
      </p>
    </div>
  );
});
