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
         comme un rendu casse (« donut »). L'anneau colle a la pilule.
         Le reste — piste de verre, dégradé allumé, lueur, état pressé — vit
         dans `theme/controls.css` (`.ctl-switch`). */
      className="ctl-switch relative h-6 w-11 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      {/* Le pouce se DÉPLACE (`translate`), il ne se repeint jamais — et son
          ancre horizontale est posée dans la feuille, avec la leçon qui l'a
          rendue nécessaire (`.ctl-switch-thumb`). */}
      <span aria-hidden="true" className="ctl-switch-thumb" />
    </button>
  );
}
