import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CryingTentacle } from "../components/CryingTentacle";
import { PageTransition } from "../components/PageTransition";

/**
 * 404 page — replaces the silent wildcard redirect.
 * Reuses CryingTentacle (previously offline-only) so the brand mascot
 * gets a second life and helps users understand what happened.
 */
export function NotFound() {
  const { t } = useTranslation("common");

  return (
    <PageTransition>
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: "var(--surface-0)" }}
      >
        <div className="mb-6">
          <CryingTentacle size={160} />
        </div>

        <p
          className="mb-3 text-xs font-bold uppercase tracking-[0.32em]"
          style={{ color: "var(--brand-light)" }}
        >
          404
        </p>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
          {t("common:notFoundTitle", { defaultValue: "Page introuvable" })}
        </h1>
        <p className="mb-8 max-w-md text-sm leading-relaxed text-white/60">
          {t("common:notFoundDescription", {
            defaultValue:
              "Le tentacle a cherché partout, mais cette page semble avoir disparu dans les abysses.",
          })}
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition-all duration-200 hover:scale-[1.03] hover:bg-white/90"
          style={{ boxShadow: "0 8px 30px rgba(139,92,246,0.35)" }}
        >
          {t("common:backHome", { defaultValue: "Retour à l'accueil" })}
        </Link>
      </div>
    </PageTransition>
  );
}
