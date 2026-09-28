import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { GalleryHorizontalEnd, Sparkles, type LucideIcon } from "lucide-react";
import { RECO_PATH, RECO_REFINE_PATH, type RecoSection } from "../../lib/recoSections";

interface RecoSectionSwitchProps {
  section: RecoSection;
}

const SECTIONS: ReadonlyArray<{ key: RecoSection; path: string; labelKey: string; Icon: LucideIcon }> = [
  { key: "forYou", path: RECO_PATH, labelKey: "sectionForYou", Icon: Sparkles },
  { key: "refine", path: RECO_REFINE_PATH, labelKey: "sectionRefine", Icon: GalleryHorizontalEnd },
];

/**
 * « Pour vous · Affiner » — les deux sections de la page Recommandations.
 *
 * La pile de swipe n'est pas une destination à part : elle NOURRIT cette page.
 * Un segment en tête dit exactement ça — deux faces d'un même écran, l'une
 * pour regarder ce qui est proposé, l'autre pour l'affiner — là où un onglet
 * de plus surchargeait la barre (six onglets avec une extension sur mobile).
 *
 * Des LIENS, pas des boutons d'état : chaque section a son URL (lien profond,
 * retour du navigateur), et `replace` évite qu'un aller-retour entre les deux
 * n'empile l'historique. Même dessin que le segment de la bibliothèque : le
 * repère au dégradé de marque glisse (`layoutId`, donc `transform`), immédiat
 * quand l'utilisateur réduit les animations.
 */
export const RecoSectionSwitch = memo(function RecoSectionSwitch({ section }: RecoSectionSwitchProps) {
  const { t } = useTranslation("swipe");
  const reduced = useReducedMotion();

  return (
    <nav
      aria-label={t("sectionsLabel")}
      className="inline-flex items-center rounded-full bg-[color:var(--surface-2)] p-[3px] ring-1 ring-line-strong"
    >
      {SECTIONS.map(({ key, path, labelKey, Icon }) => {
        const selected = key === section;
        return (
          <Link
            key={key}
            to={path}
            replace
            aria-current={selected ? "page" : undefined}
            className={`relative isolate flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)] ${
              selected ? "text-cta-brand-fg" : "text-content-secondary hover:text-content-primary"
            }`}
          >
            {selected && (
              <motion.span
                aria-hidden
                layoutId="reco-section-marker"
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))",
                  boxShadow: "0 2px 10px rgba(var(--brand-rgb),0.35)",
                }}
              />
            )}
            <Icon size={15} aria-hidden />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
});
