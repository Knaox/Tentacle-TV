import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyIcon as LockKeyhole } from "@phosphor-icons/react/dist/csr/LockKey";
import { OwnPinDialog } from "../page/PinEditors";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/**
 * La carte « Action recommandée » en tête de Réglages › Famille — tant que le
 * profil n'a pas de code PIN (règle partagée, `card`). Pas de « plus tard » :
 * elle s'en va d'elle-même dès que le code est posé (la Famille relue le dit).
 * Fond opaque teinté de la marque, sans `backdrop-filter` : rien à flouter
 * derrière, rien à payer.
 */
export function FamilyPinCard() {
  const { t } = useTranslation("family");
  const { card } = useFamilyPinReminder();
  const [editing, setEditing] = useState(false);
  const titleId = useId();
  if (!card && !editing) return null;

  return (
    <>
      {card && (
        <section
          aria-labelledby={titleId}
          className="lg-content ui-panel relative mb-6 overflow-hidden p-5 shadow-[inset_0_0_0_1.5px_var(--accent)]"
        >
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent"
            >
              <LockKeyhole size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="ui-eyebrow">
                {t("pinSuggest.eyebrow")}
              </p>
              <h2 id={titleId} className="mt-1 text-heading-3 text-content-primary">
                {t("pinSuggest.title")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">{t("pinSuggest.body")}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-solid flex-shrink-0"
            >
              {t("pinSuggest.set")}
            </button>
          </div>
        </section>
      )}
      {editing && <OwnPinDialog hasPin={false} onClose={() => setEditing(false)} />}
    </>
  );
}
