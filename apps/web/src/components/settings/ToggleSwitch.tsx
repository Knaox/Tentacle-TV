interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Libellé accessible — la piste n'a aucun texte visible. */
  label: string;
  disabled?: boolean;
}

/**
 * Interrupteur façon iOS.
 *
 * `role="switch"` plutôt qu'une case à cocher stylée : les lecteurs d'écran
 * annoncent alors « activé / désactivé » et non « coché », ce qui correspond à
 * ce que fait réellement le contrôle. Focus visible au clavier — il ne l'était
 * nulle part dans les réglages jusqu'ici.
 */
export function ToggleSwitch({ checked, onChange, label, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 ${
        checked ? "bg-tentacle-accent" : "bg-fill-medium"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-cta-primary-bg shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
