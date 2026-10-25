import { memo, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { USER_RIGHTS_FIELDS, type UserRightsFieldSpec, type UserRightsKey } from "@tentacle-tv/shared";
import { ToggleSwitch } from "../../../settings/ToggleSwitch";
import { CHECKBOX, FIELD_HINT, FIELD_LABEL, INPUT, SMALL_BUTTON } from "../../../parental/fieldStyles";
import type { RightsWriter } from "./useRightsWriter";

/** Le refus du serveur sous le réglage qui l'a provoqué (annoncé aux lecteurs d'écran). */
export function RightError({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="mt-1.5 text-xs text-status-error-fg">{text}</p>;
}

interface ToggleRightProps {
  field: UserRightsKey;
  checked: boolean;
  writer: RightsWriter;
  /** Pourquoi le réglage est figé (ex. « vous ne pouvez pas… ») ; absent : modifiable. */
  lockedReason?: string;
  /** Un autre nom et une autre aide pour le MÊME champ (rubrique « Musique · Octave »). */
  label?: string;
  hint?: string;
}

/** Un droit oui / non : libellé, une ligne d'explication, l'interrupteur. */
export const ToggleRight = memo(function ToggleRight({ field, checked, writer, lockedReason, label: ownLabel, hint }: ToggleRightProps) {
  const { t } = useTranslation("userRights");
  const label = ownLabel ?? t(`fields.${field}.label`);
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className={FIELD_LABEL}>{label}</span>
          <span className={FIELD_HINT}>{lockedReason ?? hint ?? t(`fields.${field}.hint`)}</span>
        </span>
        <span className="pt-0.5">
          <ToggleSwitch
            checked={checked}
            label={label}
            disabled={!!lockedReason || writer.isPending(field)}
            onChange={(next) => writer.write({ [field]: next })}
          />
        </span>
      </div>
      <RightError text={writer.errorFor(field)} />
    </div>
  );
});

interface NumberRightProps {
  field: UserRightsKey;
  /** La valeur affichée (déjà convertie : Mbit/s pour un débit). */
  value: number;
  writer: RightsWriter;
  /** Décimales permises (un débit) ; entier sinon. */
  decimals?: boolean;
  suffix?: string;
  /** La valeur affichée → celle du contrat, et retour (bornes dites à l'écran). */
  toRight?: (value: number) => number;
  fromRight?: (value: number) => number;
}

const same = (value: number) => value;

/**
 * Un nombre : le champ garde la saisie, « Enregistrer » (ou Entrée) l'écrit.
 * Il ne part jamais à chaque touche ; la valeur relue le remplace ensuite.
 * Les bornes sont celles du contrat (`USER_RIGHTS_FIELDS`) : une valeur hors
 * limites est dite tout de suite, sans aller-retour — le serveur reste juge.
 */
export const NumberRight = memo(function NumberRight({
  field, value, writer, decimals, suffix, toRight = same, fromRight = same,
}: NumberRightProps) {
  const { t } = useTranslation("userRights");
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(String(value));
  // La valeur relue (après écriture, ou changée dans Jellyfin) remplace la saisie.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(String(value));
  }
  const spec: UserRightsFieldSpec = USER_RIGHTS_FIELDS[field];
  const min = spec.min ?? 0;
  const max = spec.max ?? Number.MAX_SAFE_INTEGER;
  const parsed = Number(draft.replace(",", "."));
  const wellFormed = draft.trim() !== "" && Number.isFinite(parsed) && (decimals || Number.isInteger(parsed));
  const inRange = wellFormed && toRight(parsed) >= min && toRight(parsed) <= max;
  const valid = wellFormed && inRange;
  const changed = valid && parsed !== value;
  const save = () => {
    if (changed) writer.write({ [field]: toRight(parsed) });
  };
  const localError = draft.trim() === "" || valid
    ? null
    : wellFormed
      ? t("number.range", { min: fromRight(min), max: fromRight(max) })
      : t("number.invalid");
  const error = localError ?? writer.errorFor(field);

  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>{t(`fields.${field}.label`)}</label>
      <span className={FIELD_HINT}>{t(`fields.${field}.hint`)}</span>
      <div className="mt-2 flex items-center gap-2">
        <span className="relative w-32">
          <input
            id={id}
            type="text"
            inputMode={decimals ? "decimal" : "numeric"}
            value={draft}
            disabled={writer.isPending(field)}
            aria-invalid={!valid}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
            }}
            className={`${INPUT} tabular-nums ${suffix ? "pr-14" : ""}`}
          />
          {suffix && <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-tertiary">{suffix}</span>}
        </span>
        {changed && (
          <button type="button" onClick={save} disabled={writer.isPending(field)} className={SMALL_BUTTON}>
            {t("number.save")}
          </button>
        )}
      </div>
      <span id={errorId}><RightError text={error} /></span>
    </div>
  );
});

interface CheckListProps {
  title: string;
  hint: string;
  items: readonly { id: string; name: string; detail?: string }[];
  value: readonly string[];
  disabled?: boolean;
  empty: string;
  onToggle: (id: string, on: boolean) => void;
  footer?: ReactNode;
}

/** Une liste à cocher, par NOM (bibliothèques, chaînes) — jamais un identifiant à l'écran. */
export function CheckList({ title, hint, items, value, disabled, empty, onToggle, footer }: CheckListProps) {
  const titleId = useId();
  return (
    <fieldset aria-labelledby={titleId}>
      <legend id={titleId} className={FIELD_LABEL}>{title}</legend>
      <span className={FIELD_HINT}>{hint}</span>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-content-quaternary">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-fill-subtle">
                <input type="checkbox" className={CHECKBOX} checked={value.includes(item.id)} disabled={disabled}
                  onChange={(event) => onToggle(item.id, event.target.checked)} />
                <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{item.name}</span>
                {item.detail && <span className="shrink-0 text-xs text-content-tertiary">{item.detail}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </fieldset>
  );
}
