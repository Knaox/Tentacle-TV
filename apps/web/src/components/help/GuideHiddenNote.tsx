import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsHintDismissed, useSetHintDismissed } from "@tentacle-tv/api-client";

/**
 * Le chemin du retour : quand le rappel « Vous ne voyez pas les
 * bandes-annonces ? » a été masqué pour de bon, le guide dit où il est passé
 * et permet de le réafficher. Rien tant qu'il ne l'est pas — ni tant que la
 * préférence n'est pas lue.
 */
export function GuideHiddenNote() {
  const { t } = useTranslation("trailerHelp");
  const hidden = useIsHintDismissed("trailerHelp");
  const setDismissed = useSetHintDismissed();
  const [restored, setRestored] = useState(false);

  if (restored) {
    return (
      <p role="status" className="mt-12 border-t border-line-subtle pt-6 text-sm text-content-secondary">
        {t("shownAgain")}
      </p>
    );
  }
  if (hidden !== true) return null;

  return (
    <div className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-subtle pt-6 text-sm text-content-secondary">
      <span>{t("hiddenNote")}</span>
      <button
        type="button"
        disabled={setDismissed.isPending}
        onClick={() => setDismissed.mutate({ hint: "trailerHelp", dismissed: false }, { onSuccess: () => setRestored(true) })}
        className="btn btn-soft btn-sm"
      >
        {t("showAgain")}
      </button>
    </div>
  );
}
