import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RECO_PATH, RECO_REFINE_PATH, type RecoSection } from "../../../lib/recoSections";
import { HEADER_TOTAL } from "../../shell/metrics";

const SECTIONS: ReadonlyArray<{ key: RecoSection; path: string; labelKey: string }> = [
  { key: "forYou", path: RECO_PATH, labelKey: "sectionForYou" },
  { key: "refine", path: RECO_REFINE_PATH, labelKey: "sectionRefine" },
];

/**
 * « Pour vous · Affiner » du web étroit — le jumeau de `RecoSectionBar` du
 * mobile (session design, 20/10) : une pastille en verre FIXÉE sous l'en-tête
 * (`sticky`), en deux moitiés égales, toujours visible — l'ancien segment
 * défilait avec la page. Le pouce NEUTRE glisse d'une moitié à l'autre
 * (`transform` seul), sur la surface levée du thème (`--surface-3`) : jamais le dégradé
 * de marque. Le verre n'est pas gratuit (règle GPU n° 1) mais il est vu : la
 * page défile dessous. Le bureau garde `RecoSectionSwitch`.
 *
 * Des LIENS, comme le segment du bureau : chaque section a son URL, `replace`
 * n'empile pas l'historique.
 */
export const RecoSectionBar = memo(function RecoSectionBar({ section }: { section: RecoSection }) {
  const { t } = useTranslation("swipe");
  const index = section === "refine" ? 1 : 0;
  return (
    <div className="sticky z-20 px-4 py-2" style={{ top: HEADER_TOTAL }}>
      <nav
        aria-label={t("sectionsLabel")}
        className="relative mx-auto flex h-11 max-w-[420px] rounded-full border border-line-subtle bg-[color:var(--glass-tint)] p-[3px] backdrop-blur-xl"
      >
        <span
          aria-hidden
          className="absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-full bg-[color:var(--surface-3)] shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {SECTIONS.map(({ key, path, labelKey }) => {
          const selected = key === section;
          return (
            <Link
              key={key}
              to={path}
              replace
              aria-current={selected ? "page" : undefined}
              className={`relative z-10 flex flex-1 items-center justify-center rounded-full text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                selected ? "text-content-primary" : "text-content-secondary"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
});
