import { memo } from "react";
import type { LucideIcon } from "lucide-react";

export interface ChoiceOption {
  value: string;
  label: string;
}

/**
 * Le segmenté COMPACT de l'app (`SegmentedChoice compact`) : groupe rayon 10,
 * filet, fond `surface.s1`, marge 2 ; options de 32 de haut, 52 de large au
 * moins, 14 de marge, libellé 11. La peau (dégradé de marque sous l'option
 * retenue, fondu d'opacité) est celle du web, `.ctl-segment` de
 * `theme/controls.css` ; les tailles tactiles de cette feuille sont écrasées
 * pour retrouver les mesures de l'app.
 */
export const CompactSegmented = memo(function CompactSegmented({ options, value, onChange, label }: {
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex shrink-0 gap-0.5 rounded-[10px] border border-line-subtle bg-surface-1 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className="ctl-segment flex !min-h-8 min-w-[52px] items-center justify-center whitespace-nowrap !px-3.5 !text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
});

/**
 * `SettingsChoiceRow` de l'app : deux ou trois mots courts (thème, langue,
 * validité) posés à droite d'une ligne ordinaire. Le libellé garde au moins
 * 132 ; en deçà, le segmenté passe dessous (retour à la ligne flex).
 */
export function SettingsChoiceRow({ icon: Icon, label, options, value, onChange, last }: {
  icon?: LucideIcon;
  label: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}) {
  return (
    <div className={`flex min-h-[52px] flex-wrap items-center gap-2 px-3 py-2 ${last ? "" : "border-b border-line-subtle"}`}>
      <div className="flex grow basis-[132px] items-center gap-2">
        {Icon ? (
          <span aria-hidden className="flex w-[22px] shrink-0 justify-center text-content-secondary">
            <Icon size={19} strokeWidth={2} />
          </span>
        ) : null}
        <span className="line-clamp-2 shrink text-[15px] font-medium tracking-[-0.075px] text-content-primary">{label}</span>
      </div>
      <div className="ml-auto">
        <CompactSegmented options={options} value={value} onChange={onChange} label={label} />
      </div>
    </div>
  );
}
