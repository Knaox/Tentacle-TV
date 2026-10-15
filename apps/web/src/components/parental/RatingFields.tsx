import { memo, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { UnratedItemType, UserRightsOptions } from "@tentacle-tv/shared";
import { CHECKBOX, FIELD_HINT, FIELD_LABEL, SELECT } from "./fieldStyles";
import { currentRating, ratingChoices, ratingLabel, toggleInList } from "./parentalModel";

const NONE = "none";

interface RatingSelectProps {
  ratings: UserRightsOptions["parentalRatings"];
  score: number | null;
  subScore: number | null;
  disabled?: boolean;
  /** L'identifiant du `<select>` — pour y poser le premier focus d'un dialogue. */
  id?: string;
  onChange: (score: number | null, subScore: number | null) => void;
}

/**
 * La note maximale, choisie dans la table de Jellyfin : un niveau par ligne,
 * les noms de chaque pays réunis (« 12, PG-13, FSK 12 »), du plus permissif au
 * plus strict. Une note posée que la table ne connaît pas reste affichée.
 */
export const RatingSelect = memo(function RatingSelect({ ratings, score, subScore, disabled, id: givenId, onChange }: RatingSelectProps) {
  const { t } = useTranslation("userRights");
  const ownId = useId();
  const id = givenId ?? ownId;
  const choices = useMemo(() => ratingChoices(ratings), [ratings]);
  const current = currentRating(choices, score, subScore);
  const unknown = current && !choices.some((choice) => choice.key === current.key) ? current : null;

  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>{t("fields.maxParentalRating.label")}</label>
      <span className={FIELD_HINT}>{t("fields.maxParentalRating.hint")}</span>
      <span className="relative mt-2 block">
        <select
          id={id}
          value={current?.key ?? NONE}
          disabled={disabled}
          onChange={(event) => {
            const choice = choices.find((entry) => entry.key === event.target.value);
            onChange(choice ? choice.score : null, choice ? choice.subScore : null);
          }}
          className={SELECT}
        >
          <option value={NONE}>{t("values.noLimit")}</option>
          {unknown && <option value={unknown.key}>{t("parental.unknownRating", { score: unknown.score })}</option>}
          {choices.map((choice) => (
            <option key={choice.key} value={choice.key}>{ratingLabel(choice, 4)}</option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
      </span>
    </div>
  );
});

interface UnratedTypesFieldProps {
  types: readonly UnratedItemType[];
  value: readonly UnratedItemType[];
  disabled?: boolean;
  onChange: (next: UnratedItemType[]) => void;
}

/** Les types bloqués quand un titre n'a pas de note : une case par type que Jellyfin connaît. */
export const UnratedTypesField = memo(function UnratedTypesField({ types, value, disabled, onChange }: UnratedTypesFieldProps) {
  const { t } = useTranslation("userRights");
  const titleId = useId();
  // Un type posé dans Jellyfin que la liste ne propose plus reste visible, et décochable.
  const shown = useMemo(() => [...types, ...value.filter((type) => !types.includes(type))], [types, value]);

  return (
    <fieldset aria-labelledby={titleId}>
      <legend id={titleId} className={FIELD_LABEL}>{t("fields.blockUnratedItems.label")}</legend>
      <span className={FIELD_HINT}>{t("fields.blockUnratedItems.hint")}</span>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {shown.map((type) => (
          <label key={type} className="flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm text-content-secondary hover:text-content-primary">
            <input
              type="checkbox"
              className={CHECKBOX}
              checked={value.includes(type)}
              disabled={disabled}
              onChange={(event) => onChange(toggleInList(value, type, event.target.checked))}
            />
            {t(`parental.unrated.${type}`, { defaultValue: type })}
          </label>
        ))}
      </div>
    </fieldset>
  );
});
