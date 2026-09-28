import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { STACKED_TOP } from "../../mirror/screens/collection/CollectionHero";

/**
 * Le halo de l'en-tête : la marque (violet, puis rose en retrait), en
 * dégradés radiaux FIXES. Aucune image : la page prenait la teinte de
 * l'affiche du titre le plus regardé — le vert d'une forêt chez qui regarde
 * « Dark ». Statique, sans flou : rien à recomposer (règle GPU).
 */
const GLOW =
  "radial-gradient(70% 140% at 0% 0%, rgba(var(--brand-rgb), 0.16) 0%, transparent 62%), " +
  "radial-gradient(45% 120% at 100% 0%, rgba(var(--brand-accent-rgb), 0.07) 0%, transparent 70%)";

interface StatsHeaderProps {
  title: string;
  kicker: string;
  /** Au téléphone (miroir) : le retour flottant de l'écran empilé. */
  onBack?: () => void;
}

/**
 * L'en-tête de « Vos statistiques » : le surtitre et le titre, aux couleurs
 * de l'app, sur le halo de marque. Les marges sont celles du contenu :
 * titre et cartes s'alignent.
 */
export const StatsHeader = memo(function StatsHeader({ title, kicker, onBack }: StatsHeaderProps) {
  const { t } = useTranslation("common");
  return (
    <header
      className="relative isolate px-4 pb-5 sm:px-8 md:px-14 md:pb-7"
      style={{ paddingTop: onBack ? `calc(${STACKED_TOP} + 60px)` : "2.5rem" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10" style={{ top: onBack ? `calc(-1 * ${STACKED_TOP})` : 0, background: GLOW }} />
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-content-tertiary">
        <span
          aria-hidden
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))" }}
        />
        {kicker}
      </p>
      <h1 className="mt-2 text-display-3 text-content-primary md:text-display-2">{title}</h1>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="fixed left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-content-primary transition-transform duration-100 active:scale-95 active:opacity-80"
          style={{ top: `calc(${STACKED_TOP} + 4px)`, background: "color-mix(in srgb, var(--surface-0) 72%, transparent)" }}
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
      )}
    </header>
  );
});
