import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

export type SetupStep = "db" | "jellyfin" | "admin";

const STEPS: { key: SetupStep; label: string }[] = [
  { key: "db", label: "stepDatabase" },
  { key: "jellyfin", label: "stepJellyfin" },
  { key: "admin", label: "stepAdmin" },
];

/**
 * La progression de l'assistant d'installation : une liste ordonnée, l'étape
 * courante marquée `aria-current`, les étapes faites cochées (icône, pas un
 * « ✓ » de police).
 */
export function SetupStepper({ step }: { step: SetupStep }) {
  const { t } = useTranslation("setup");
  const index = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-light)]">
        {t("configTitle")}
      </p>
      <p className="sr-only">{t("stepProgress", { current: index + 1, total: STEPS.length })}</p>
      <ol className="mt-3 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < index;
          const current = i === index;
          const last = i === STEPS.length - 1;
          return (
            <li key={s.key} aria-current={current ? "step" : undefined} className={`flex items-center gap-2 ${last ? "" : "flex-1"}`}>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  done
                    ? "border-status-success bg-status-success-bg text-status-success-fg"
                    : current
                      ? "border-[rgba(var(--brand-rgb),0.55)] bg-[var(--brand-soft)] text-[var(--brand-light)]"
                      : "border-line-subtle bg-fill-faint text-content-quaternary"
                }`}
              >
                {done ? <Check aria-hidden size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              {/* Sur un téléphone, seule l'étape courante garde son nom : trois libellés
                  n'y tiennent pas sans être tronqués. */}
              <span className={`whitespace-nowrap text-xs ${current ? "font-semibold text-content-primary" : "hidden text-content-tertiary sm:inline"}`}>
                {t(s.label)}
              </span>
              {!last && <span aria-hidden className="h-px min-w-3 flex-1 bg-fill-medium" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
