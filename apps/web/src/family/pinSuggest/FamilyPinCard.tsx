import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";
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
          className="lg-content relative mb-6 overflow-hidden rounded-2xl border border-[rgba(var(--brand-rgb),0.35)] bg-surface-1 p-5"
        >
          <div
            aria-hidden="true"
            className="lg-content-ornament pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(135deg, rgba(var(--brand-rgb), 0.18), rgba(var(--brand-accent-rgb), 0.10) 60%, transparent)" }}
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-cta-brand-fg"
              style={{ backgroundImage: "var(--cta-brand-gradient)" }}
            >
              <LockKeyhole size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-light)]">
                {t("pinSuggest.eyebrow")}
              </p>
              <h2 id={titleId} className="mt-1 text-base font-bold tracking-tight text-content-primary">
                {t("pinSuggest.title")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">{t("pinSuggest.body")}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-11 flex-shrink-0 items-center justify-center rounded-lg px-5 text-sm font-bold text-cta-brand-fg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              style={{ backgroundImage: "var(--cta-brand-gradient)" }}
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
