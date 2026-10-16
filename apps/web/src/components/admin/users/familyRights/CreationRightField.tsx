import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { FAMILY_CREATION_RIGHT_VALUES, type AccountFamilyRightsDto, type FamilyCreationRightValue } from "@tentacle-tv/shared";
import { CHECKBOX, FIELD_HINT, FIELD_LABEL } from "../../../parental/fieldStyles";
import { creationNote, inheritValue, isAllowed, rightValue, type CreationRightKey } from "./familyRightsModel";

interface CreationRightFieldProps {
  dto: AccountFamilyRightsDto;
  right: CreationRightKey;
  pending: boolean;
  error: string | null;
  onChange: (value: FamilyCreationRightValue) => void;
}

/**
 * Un droit de création — « Créer une famille », « Créer des profils invités », et (1.30.0)
 * « Autoriser ses invités à demander des films » — en trois
 * boutons radio expliqués (Par défaut, Permis, Refusé), comme les droits à quelques valeurs
 * de la fiche (`ChoiceRight`). Sous le titre : ce qui vaut, et pourquoi quand ce n'est pas
 * le réglage qui décide (administrateur, interrupteur coupé). Le choix s'écrit aussitôt.
 */
export const CreationRightField = memo(function CreationRightField({ dto, right, pending, error, onChange }: CreationRightFieldProps) {
  const { t } = useTranslation("familyWeb");
  const titleId = useId();
  const name = useId();
  const note = creationNote(dto, right);
  const current = rightValue(dto, right);
  const yesNo = t(inheritValue(dto, right) ? "accountRights.yes" : "accountRights.no");
  const label: Record<FamilyCreationRightValue, string> = {
    inherit: t("accountRights.inherit", { value: yesNo }),
    allow: t("accountRights.allow"),
    deny: t("accountRights.deny"),
  };
  const detail: Record<FamilyCreationRightValue, string> = {
    inherit: t("accountRights.inheritDetail", { value: yesNo }),
    allow: t("accountRights.allowDetail"),
    deny: t("accountRights.denyDetail"),
  };
  return (
    <fieldset aria-labelledby={titleId} aria-busy={pending || undefined}>
      <legend id={titleId} className={FIELD_LABEL}>{t(`accountRights.${right}`)}</legend>
      <span className={FIELD_HINT}>
        {t(isAllowed(dto, right) ? "accountRights.allowed" : "accountRights.denied")}
        {note && <> · {t(`accountRights.${note}`)}</>}
      </span>
      <div className="mt-2 space-y-1">
        {FAMILY_CREATION_RIGHT_VALUES.map((value) => (
          <label
            key={value}
            className={`flex min-h-[44px] items-start gap-3 rounded-lg px-2 py-2 hover:bg-fill-subtle ${current === value ? "bg-fill-subtle" : ""} ${pending ? "cursor-default" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={current === value}
              disabled={pending}
              onChange={() => onChange(value)}
              className={`${CHECKBOX} mt-0.5 rounded-full`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-content-primary">{label[value]}</span>
              <span className="block text-xs leading-relaxed text-content-tertiary">{detail[value]}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs text-status-error-fg">{error}</p>}
    </fieldset>
  );
});
