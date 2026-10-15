import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { CHIP, CHIP_REMOVE, FIELD_HINT, FIELD_LABEL, INPUT, SMALL_BUTTON } from "./fieldStyles";
import { addTag, normalizeTag, removeTag, tagSuggestions } from "./parentalModel";

interface TagListFieldProps {
  field: "blockedTags" | "allowedTags";
  value: readonly string[];
  /** Les étiquettes de la bibliothèque, proposées à la saisie. */
  known: readonly string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}

/**
 * Une liste d'étiquettes : des pastilles qu'on retire d'une croix, un champ
 * qui en ajoute une (Entrée ou « Ajouter ») et propose celles que la
 * bibliothèque porte déjà — une `datalist` native, que clavier et lecteurs
 * d'écran savent parcourir.
 */
export const TagListField = memo(function TagListField({ field, value, known, disabled, onChange }: TagListFieldProps) {
  const { t } = useTranslation("userRights");
  const inputId = useId();
  const listId = useId();
  const [draft, setDraft] = useState("");
  const suggestions = tagSuggestions(known, value, draft, 30);
  const canAdd = normalizeTag(draft) !== "" && addTag(value, draft).length > value.length;

  const add = () => {
    if (!canAdd) return;
    onChange(addTag(value, draft));
    setDraft("");
  };

  return (
    <div>
      <label htmlFor={inputId} className={FIELD_LABEL}>{t(`fields.${field}.label`)}</label>
      <span className={FIELD_HINT}>{t(`fields.${field}.hint`)}</span>
      {value.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag} className={CHIP}>
              <span className="truncate">{tag}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(removeTag(value, tag))}
                aria-label={t("parental.tagRemove", { tag })}
                className={CHIP_REMOVE}
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-content-quaternary">{t("parental.tagEmpty")}</p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="text"
          value={draft}
          list={suggestions.length ? listId : undefined}
          disabled={disabled}
          placeholder={t("parental.tagPlaceholder")}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          className={INPUT}
        />
        <button type="button" onClick={add} disabled={disabled || !canAdd} className={SMALL_BUTTON}>
          <Plus aria-hidden className="h-3.5 w-3.5" />
          {t("parental.tagAdd")}
        </button>
      </div>
      {suggestions.length > 0 && (
        <datalist id={listId} aria-label={t("parental.tagSuggestions")}>
          {suggestions.map((tag) => <option key={tag} value={tag} />)}
        </datalist>
      )}
    </div>
  );
});
