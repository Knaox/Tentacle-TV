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
      /* Focus SANS ring-offset : l'ecart blanc entre pilule et anneau se lisait
         comme un rendu casse (« donut »). L'anneau colle a la pilule. */
      className={`relative h-6 w-11 shrink-0 rounded-full border border-black/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        checked ? "bg-tentacle-accent" : "bg-fill-strong"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        aria-hidden="true"
        /* left-0 est INDISPENSABLE : un absolu sans ancre horizontale garde sa
           position STATIQUE, et un <button> centre son contenu — le pouce
           partait donc du centre de la pilule. OFF : il flottait a droite du
           milieu ; ON : +22px le poussait hors de la pilule, fondu dans la
           carte blanche. C'etait le « toggle bugge » des captures. */
        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-cta-primary-bg shadow-sm ring-1 ring-black/15 transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
