import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRightIcon as ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { SlideshowIcon as GalleryHorizontalEnd } from "@phosphor-icons/react/dist/csr/Slideshow";
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
        className="group flex items-center gap-4 rounded-tile bg-surface-2 p-4 transition-colors duration-hover hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus sm:p-5"
      >
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent"
        >
          <GalleryHorizontalEnd size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-content-primary">{t("teaserTitle")}</span>
          <span className="mt-0.5 block text-sm text-content-secondary">{t("teaserBody")}</span>
        </span>
        <span className="btn btn-sm btn-soft hidden shrink-0 sm:inline-flex">
          {t("teaserCta")}
          <ArrowRight size={15} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
        <ArrowRight size={18} aria-hidden className="shrink-0 text-content-tertiary sm:hidden" />
      </Link>
    </div>
  );
});
