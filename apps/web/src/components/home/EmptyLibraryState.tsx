import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { setupDocUrl } from "@tentacle-tv/shared";
import { TentacleSvg } from "../ui/TentacleSvg";
import { getUserInfo } from "../userMenu/menuItems";

/**
 * L'accueil d'un compte sans AUCUN titre (`libraryHasNoTitles`) : avant, la
 * bannière et les rangées ne rendaient rien et l'écran restait noir. Ici, ce
 * qui se passe et quoi faire — l'administrateur a le guide pour
 * ajouter du contenu, les autres le simple constat. « Vérifier à nouveau » relit
 * les bibliothèques ; un ajout le fait aussi tout seul (socket de l'accueil).
 *
 * Coût GPU : halo et ombre FIXES, aucune animation infinie.
 */
export const EmptyLibraryState = memo(function EmptyLibraryState() {
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();
  const isAdmin = getUserInfo().isAdmin;
  const [checking, setChecking] = useState(false);

  const recheck = useCallback(() => {
    setChecking(true);
    void queryClient
      .refetchQueries({ queryKey: ["libraries"] })
      .finally(() => setChecking(false));
  }, [queryClient]);

  return (
    <section
      role="status"
      aria-labelledby="empty-library-title"
      className="row-gutter flex min-h-[calc(100dvh-10rem)] items-center justify-center py-16"
    >
      <div className="flex w-full max-w-xl flex-col items-center text-center animate-fade-slide-up">
        <span
          aria-hidden="true"
          className="inline-flex h-36 w-36 items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb), 0.32) 0%, rgba(var(--brand-rgb), 0) 70%)" }}
        >
          <TentacleSvg size={112} style={{ filter: "drop-shadow(0 6px 24px rgba(var(--brand-rgb), 0.45))" }} />
        </span>

        <h1 id="empty-library-title" className="mt-6 text-2xl font-extrabold tracking-tight text-content-primary sm:text-3xl">
          {t("emptyHomeTitle")}
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-content-secondary">
          {isAdmin ? t("emptyHomeAdminHint") : t("emptyHomeHint")}
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          {isAdmin ? (
            <a
              href={setupDocUrl("addContent", i18n.language ?? "en")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cta-primary-border bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <BookOpen size={16} aria-hidden="true" />
              {t("emptyHomeGuide")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={recheck}
            disabled={checking}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary transition-colors hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} aria-hidden="true" className={checking ? "animate-spin motion-reduce:animate-none" : undefined} />
            {t("emptyHomeRefresh")}
          </button>
        </div>

      </div>
    </section>
  );
});
