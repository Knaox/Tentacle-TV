import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { TRAILER_GUIDE_PARTS } from "@tentacle-tv/shared";
import { STACKED_TOP } from "../../mirror/screens/collection/CollectionHero";

const PART_LABEL = { everyone: "partEveryone", admin: "partAdmin" } as const;

/**
 * L'en-tête du guide : le surtitre « Guides » au trait de marque (celui de
 * « Vos statistiques »), le titre, la phrase qui dit à quoi sert la page, et
 * le sommaire — deux ancres, une par partie.
 *
 * `onBack` : au téléphone (miroir), le retour flottant de l'écran empilé.
 */
export const GuideHeader = memo(function GuideHeader({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation("trailerHelp");
  const { t: tc } = useTranslation("common");

  return (
    <header style={{ paddingTop: onBack ? `calc(${STACKED_TOP} + 60px)` : "2.5rem" }}>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-content-tertiary">
        <span
          aria-hidden
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))" }}
        />
        {t("helpGuidesTitle")}
      </p>
      <h1 className="mt-2 text-display-3 text-content-primary md:text-display-2">{t("title")}</h1>
      <p className="mt-3 text-base leading-relaxed text-content-secondary">{t("lead")}</p>
      <nav aria-label={t("contentsLabel")} className="mt-6 flex flex-wrap gap-2">
        {TRAILER_GUIDE_PARTS.map((part) => (
          <Link
            key={part}
            to={{ hash: `#${part}` }}
            className="inline-flex min-h-[2.5rem] items-center rounded-full border border-line-subtle bg-fill-subtle px-4 text-sm font-medium text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t(PART_LABEL[part])}
          </Link>
        ))}
      </nav>
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
