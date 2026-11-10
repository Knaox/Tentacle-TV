import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "../components/CryingTentacle";
import { PageTransition } from "../components/PageTransition";
import { BackButton } from "../components/ui/BackButton";

/**
 * 404 page — replaces the silent wildcard redirect.
 * Reuses CryingTentacle (previously offline-only) so the brand mascot
 * gets a second life and helps users understand what happened.
 */
export function NotFound() {
  const { t } = useTranslation("common");

  return (
    <PageTransition>
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface-0 px-6 text-center">
        <BackButton fallback="/" className="absolute left-4 top-4 md:left-12 md:top-6" />
        <div className="mb-6">
          <CryingTentacle size={160} />
        </div>

        <p className="ui-eyebrow num mb-3">404</p>

        <h1 className="mb-3 text-display-3 text-content-primary md:text-[2.5rem]">
          {t("common:notFoundTitle", { defaultValue: "Page introuvable" })}
        </h1>
        <p className="mb-8 max-w-md text-sm leading-relaxed text-content-secondary">
          {t("common:notFoundDescription", {
            defaultValue:
              "Le tentacle a cherché partout, mais cette page semble avoir disparu dans les abysses.",
          })}
        </p>

        <Link to="/" className="btn btn-solid btn-lg">
          {t("common:backHome", { defaultValue: "Retour à l'accueil" })}
        </Link>
      </div>
    </PageTransition>
  );
}
