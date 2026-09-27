import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, Library, PartyPopper } from "lucide-react";
import { Shimmer } from "@tentacle-tv/ui";
import { CARD_WIDTH } from "./SwipeStack";

/** Silhouette de la pile au premier chargement — la géométrie réelle. */
export function SwipeSkeleton() {
  return (
    <div className="relative mx-auto aspect-[2/3]" style={{ width: CARD_WIDTH }} aria-hidden>
      <Shimmer className="absolute inset-0 rounded-[1.75rem]" />
    </div>
  );
}

/** Sans clé TMDB : la pile ne vient que de la bibliothèque — dit une fois, calmement. */
export function SwipeLibraryOnlyNotice() {
  const { t } = useTranslation("swipe");
  return (
    <div className="flex w-full max-w-xl items-start gap-3 rounded-2xl border border-line-subtle bg-fill-subtle px-4 py-2.5 text-sm sm:py-3" role="status">
      <Library size={18} className="mt-0.5 shrink-0 text-brand-light" aria-hidden />
      <div>
        <p className="hidden font-semibold text-content-primary sm:block">{t("libraryOnlyTitle")}</p>
        <p className="mt-0.5 hidden text-content-secondary sm:block">{t("libraryOnlyBody")}</p>
        {/* Sur téléphone, une ligne : la carte garde sa place. */}
        <p className="text-xs text-content-secondary sm:hidden">{t("libraryOnlyShort")}</p>
      </div>
    </div>
  );
}

export function SwipeEmptyState() {
  const { t } = useTranslation("swipe");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-white">
        <PartyPopper size={28} aria-hidden />
      </div>
      <h2 className="mt-5 text-heading-2 text-content-primary">{t("emptyTitle")}</h2>
      <p className="mt-2 text-content-secondary">{t("emptyBody")}</p>
      <Link
        to="/recommendations"
        className="mt-6 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 py-2.5 font-semibold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
      >
        {t("emptyCta")}
      </Link>
    </div>
  );
}

export function SwipeErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("swipe");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center" role="alert">
      <AlertTriangle size={32} className="text-status-warning" aria-hidden />
      <h2 className="mt-4 text-heading-2 text-content-primary">{t("errorTitle")}</h2>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 cursor-pointer rounded-full border border-line-subtle bg-cta-secondary-bg px-5 py-2.5 font-semibold text-cta-secondary-fg transition-colors hover:bg-cta-secondary-bg-hover"
      >
        {t("retry")}
      </button>
    </div>
  );
}

/** Un verdict perdu : la carte est revenue — le dire, puis s'effacer seul. */
export function SwipeSaveFailedNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation("swipe");
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(id);
  }, [onDismiss]);
  return (
    <p className="rounded-xl border border-danger-border bg-status-error-bg px-4 py-2 text-sm text-status-error-fg" role="alert">
      {t("saveFailed")}
    </p>
  );
}
