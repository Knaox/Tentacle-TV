import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Film } from "lucide-react";
import { TRAILER_GUIDE_PATH } from "@tentacle-tv/shared";

/**
 * Les guides, en tête de l'Aide (`/support`) : lire avant d'écrire un ticket.
 * Un seul pour l'instant — « Bandes-annonces » —, la place que le rappel des
 * fiches désigne une fois masqué (« le guide reste dans Aide »).
 */
export function HelpGuides() {
  const { t } = useTranslation("trailerHelp");
  return (
    <section aria-labelledby="help-guides-title" className="mb-10">
      <h2 id="help-guides-title" className="text-lg font-semibold text-content-primary">
        {t("helpGuidesTitle")}
      </h2>
      <Link
        to={TRAILER_GUIDE_PATH}
        className="group mt-3 flex max-w-xl items-center gap-4 rounded-2xl border border-line-subtle bg-fill-faint p-4 transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fill-soft text-content-secondary">
          <Film size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-content-primary">{t("helpEntryTitle")}</span>
          <span className="mt-0.5 block text-sm text-content-secondary">{t("helpEntryBody")}</span>
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-content-tertiary transition-transform duration-150 group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}
