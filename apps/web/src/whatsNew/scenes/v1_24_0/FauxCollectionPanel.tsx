import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckSquare, LayoutGrid, List, Search, Share2 } from "lucide-react";
import { Place } from "../Place";
import { sceneSpring } from "../sceneMotion";

export const PANEL = { x: 24, y: 44, w: 592 } as const;
/** La bascule grille / liste, au bout de l'étage haut : son bouton « Liste » est visé par le curseur. */
export const VIEW_TOGGLE = { x: PANEL.x + PANEL.w - 66, y: PANEL.y + 10, cell: 26 } as const;

interface FauxCollectionPanelProps {
  view: "grid" | "list";
  /** Les comptes des étapes de visionnage : Tout, À découvrir, En cours, Terminés. */
  counts: readonly [number, number, number, number];
}

/**
 * Le panneau d'outils commun à la Bibliothèque, Ma liste et Mes favoris
 * (`CollectionToolbarPanel`) : étage haut, la recherche puis les gestes —
 * Partager au ton de la marque, Sélectionner, grille ou liste ; étage bas, ce
 * qui n'appartient qu'à Ma liste, les étapes de visionnage avec leur compte.
 */
export function FauxCollectionPanel({ view, counts }: FauxCollectionPanelProps) {
  const { t } = useTranslation(["common", "watchlist"]);
  const stages = [t("watchlist:stageAll"), t("watchlist:stageNew"), t("watchlist:stageInProgress"), t("watchlist:stageWatched")];
  return (
    <Place x={PANEL.x} y={PANEL.y} w={PANEL.w}>
      <div className="rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 p-2.5 shadow-[var(--elev-1)]">
        <div className="flex h-[26px] items-center gap-2">
          <span className="flex h-full w-[200px] items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-2.5 text-[9px] text-content-quaternary">
            <Search size={10} />
            <span className="truncate">{t("common:searchInLibrary", { name: t("common:myList") })}</span>
          </span>
          <span className="ml-auto inline-flex h-[22px] items-center gap-1 rounded-full bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-rgb),0.16),rgba(var(--brand-rgb),0.16))] px-2.5 text-[9px] font-semibold text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.5)]">
            <Share2 size={10} />
            {t("common:shareMyList")}
          </span>
          <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-[color:var(--surface-2)] px-2.5 text-[9px] font-medium text-content-secondary ring-1 ring-line-strong">
            <CheckSquare size={10} />
            {t("common:select")}
          </span>
          {/* Réserve de la bascule, posée à part pour que le curseur la vise au pixel. */}
          <span style={{ width: VIEW_TOGGLE.cell * 2 + 6 }} />
        </div>
        <div className="mt-2 flex">
          <span className="inline-flex rounded-full bg-[color:var(--surface-2)] p-[3px] ring-1 ring-line-strong">
            {stages.map((label, i) => (
              <span key={label} className={`relative flex h-[20px] items-center rounded-full px-2.5 text-[9px] font-semibold ${i === 0 ? "text-cta-brand-fg" : "text-content-secondary"}`}>
                {i === 0 && <span className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))" }} />}
                <span className="relative">{label}</span>
                <span className={`relative ml-1 tabular-nums ${i === 0 ? "opacity-80" : "text-content-quaternary"}`}>{counts[i]}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
      <span className="absolute flex rounded-full bg-[color:var(--surface-2)] p-[3px] ring-1 ring-line-strong" style={{ left: VIEW_TOGGLE.x - PANEL.x, top: VIEW_TOGGLE.y - PANEL.y }}>
        <motion.span
          className="absolute left-[3px] top-[3px] h-[20px] rounded-full"
          style={{ width: VIEW_TOGGLE.cell, background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))" }}
          initial={false}
          animate={{ x: view === "list" ? VIEW_TOGGLE.cell : 0 }}
          transition={sceneSpring}
        />
        {(["grid", "list"] as const).map((mode) => (
          <span key={mode} className={`relative flex h-[20px] items-center justify-center ${view === mode ? "text-cta-brand-fg" : "text-content-secondary"}`} style={{ width: VIEW_TOGGLE.cell }}>
            {mode === "grid" ? <LayoutGrid size={11} /> : <List size={11} />}
          </span>
        ))}
      </span>
    </Place>
  );
}
