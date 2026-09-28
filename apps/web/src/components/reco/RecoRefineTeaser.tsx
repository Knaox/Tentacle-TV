import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, GalleryHorizontalEnd } from "lucide-react";
import { RECO_REFINE_PATH } from "../../lib/recoSections";

/**
 * L'entrée vers « Affiner » AU MILIEU des rangées : le segment de tête est
 * hors de vue dès qu'on a défilé, et c'est justement en parcourant les
 * propositions qu'on a envie de les corriger.
 *
 * Aplat de surface et liseré de marque, sans `backdrop-filter` : rien ne
 * défile derrière une carte posée dans le flux, un flou n'y montrerait rien.
 * Aucune animation au repos.
 */
export const RecoRefineTeaser = memo(function RecoRefineTeaser({
  className = "row-gutter mb-10",
}: {
  /** Marges du bloc : gouttière des rangées du bureau, celle du miroir sinon. */
  className?: string;
}) {
  const { t } = useTranslation("swipe");
  return (
    <div className={className}>
      <Link
        to={RECO_REFINE_PATH}
        replace
        className="group flex items-center gap-4 rounded-2xl border border-[rgba(var(--brand-rgb),0.35)] bg-[color:var(--surface-2)] p-4 transition-colors hover:border-[rgba(var(--brand-rgb),0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)] sm:p-5"
      >
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg shadow-[0_4px_14px_rgba(var(--brand-rgb),0.35)]"
        >
          <GalleryHorizontalEnd size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-content-primary">{t("teaserTitle")}</span>
          <span className="mt-0.5 block text-sm text-content-secondary">{t("teaserBody")}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-cta-brand-fg sm:inline-flex">
          {t("teaserCta")}
          <ArrowRight size={15} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
        <ArrowRight size={18} aria-hidden className="shrink-0 text-content-tertiary sm:hidden" />
      </Link>
    </div>
  );
});
