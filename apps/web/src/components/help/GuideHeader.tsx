import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { TRAILER_GUIDE_PARTS } from "@tentacle-tv/shared";
import { STACKED_TOP } from "../../mirror/screens/collection/CollectionHero";
import { BackButton } from "../ui/BackButton";

const PART_LABEL = { everyone: "partEveryone", admin: "partAdmin" } as const;

/**
 * L'en-tête du guide : le bouton Retour commun, le surtitre « Guides », le
 * titre, la phrase qui dit à quoi sert la page, et le sommaire — deux ancres,
 * une par partie.
 *
 * `onBack` : au téléphone (miroir), le retour flottant de l'écran empilé (la
 * convention du miroir) tient lieu de bouton Retour.
 */
export const GuideHeader = memo(function GuideHeader({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation("trailerHelp");
  const { t: tc } = useTranslation("common");

  return (
    <header style={{ paddingTop: onBack ? `calc(${STACKED_TOP} + 60px)` : "2.5rem" }}>
      <div className="flex items-start gap-3">
        {onBack ? null : <BackButton fallback="/" className="-ml-1 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="ui-eyebrow">{t("helpGuidesTitle")}</p>
          <h1 className="mt-2 text-display-3 text-content-primary md:text-display-2">{t("title")}</h1>
          <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-content-secondary">{t("lead")}</p>
          <nav aria-label={t("contentsLabel")} className="mt-6 flex flex-wrap gap-2">
            {TRAILER_GUIDE_PARTS.map((part) => (
              <Link key={part} to={{ hash: `#${part}` }} className="btn btn-soft">
                {t(PART_LABEL[part])}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={tc("back")}
          className="fixed left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-content-primary transition-transform duration-100 active:scale-95 active:opacity-80"
          style={{ top: `calc(${STACKED_TOP} + 4px)`, background: "color-mix(in srgb, var(--surface-0) 72%, transparent)" }}
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
      )}
    </header>
  );
});
