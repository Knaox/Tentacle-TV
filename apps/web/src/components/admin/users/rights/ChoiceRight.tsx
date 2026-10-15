import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import type { UserRightsKey } from "@tentacle-tv/shared";
import { CHECKBOX, FIELD_HINT, FIELD_LABEL } from "../../../parental/fieldStyles";
import { RightError } from "./RightRows";
import type { RightsWriter } from "./useRightsWriter";

interface ChoiceRightProps<T extends string> {
  field: UserRightsKey;
  value: T;
  /** Chaque choix, avec la phrase qui dit ce qu'il fait pour le compte. */
  choices: readonly { value: T; label: string; detail: string }[];
  writer: RightsWriter;
}

/**
 * Un droit à quelques valeurs, chacune expliquée en clair : des boutons radio
 * plutôt qu'une liste déroulante, pour lire d'un coup d'œil ce que chaque
 * choix permet. Le choix s'écrit aussitôt, comme un interrupteur.
 */
function ChoiceRightView<T extends string>({ field, value, choices, writer }: ChoiceRightProps<T>) {
  const { t } = useTranslation("userRights");
  const titleId = useId();
  const name = useId();
  const pending = writer.isPending(field);
  return (
    <fieldset aria-labelledby={titleId} aria-busy={pending || undefined}>
      <legend id={titleId} className={FIELD_LABEL}>{t(`fields.${field}.label`)}</legend>
      <span className={FIELD_HINT}>{t(`fields.${field}.hint`)}</span>
      <div className="mt-2 space-y-1">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`flex min-h-[44px] items-start gap-3 rounded-lg px-2 py-2 hover:bg-fill-subtle ${value === choice.value ? "bg-fill-subtle" : ""} ${pending ? "cursor-default" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              disabled={pending}
              onChange={() => writer.write({ [field]: choice.value })}
              className={`${CHECKBOX} mt-0.5 rounded-full`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-content-primary">{choice.label}</span>
              <span className="block text-xs leading-relaxed text-content-tertiary">{choice.detail}</span>
            </span>
          </label>
        ))}
      </div>
      <RightError text={writer.errorFor(field)} />
    </fieldset>
  );
}

export const ChoiceRight = memo(ChoiceRightView) as typeof ChoiceRightView;
