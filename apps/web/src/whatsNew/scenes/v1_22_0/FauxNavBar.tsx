import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bookmark, ChevronDown, Film, House, LayoutGrid, Sparkles, Tv, type LucideIcon } from "lucide-react";
import { TentacleLogo } from "../../../components/ui/TentacleLogo";
import { CARD_TONES, Place, sceneTween } from "..";

/**
 * La barre de navigation, en faux : la capsule, ses onglets icône + libellé,
 * l'indicateur au dégradé de la marque (`--nav-active-bg`), « Plus », la
 * recherche et le profil — les jetons de `theme/chrome.css`.
 *
 * Les onglets ont une largeur fixe : c'est ce qui permet de décaler ceux qui
 * suivent, en transform, quand une liste s'épingle. Pas de `backdrop-filter`
 * (règle du kit) : sous le verre, une assise de surface.
 */

export type FauxTabKey = "home" | "forYou" | "myList" | "movies" | "series" | "more";

export const CAPSULE = { x: 12, y: 14, w: 616, h: 46 } as const;
const TAB_X = 48;
const TAB_W = 80;
const TAB_STEP = 82;

/** Le centre de l'emplacement `slot`, en px du canevas — la cible du curseur. */
export function tabCenter(slot: number): { x: number; y: number } {
  return { x: CAPSULE.x + TAB_X + slot * TAB_STEP + TAB_W / 2, y: CAPSULE.y + CAPSULE.h / 2 };
}

const TABS: ReadonlyArray<{ key: FauxTabKey; icon: LucideIcon; slot: number }> = [
  { key: "home", icon: House, slot: 0 },
  { key: "forYou", icon: Sparkles, slot: 1 },
  { key: "movies", icon: Film, slot: 2 },
  { key: "series", icon: Tv, slot: 3 },
  { key: "more", icon: LayoutGrid, slot: 4 },
];

function FauxTab({ icon: Icon, label, active, open = false, more = false }: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  open?: boolean;
  more?: boolean;
}) {
  return (
    <div className="relative flex h-full items-center justify-center gap-1 rounded-[10px] px-1 text-[11px]">
      <motion.span
        className="absolute inset-0 rounded-[10px]"
        style={{ background: "var(--nav-active-bg)", boxShadow: "inset 0 0 0 1px var(--nav-active-ring)" }}
        initial={false}
        animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.9 }}
        transition={sceneTween}
      />
      <motion.span className="absolute inset-0 rounded-[10px] bg-fill-soft" initial={false} animate={{ opacity: open ? 1 : 0 }} transition={sceneTween} />
      <Icon
        strokeWidth={active ? 2.2 : 1.9}
        className={`relative h-[13px] w-[13px] shrink-0 transition-colors duration-200 ${active ? "text-[var(--brand-light)]" : "text-content-quaternary"}`}
      />
      <span className={`relative whitespace-nowrap transition-colors duration-200 ${active ? "font-semibold text-content-primary" : "font-medium text-content-tertiary"}`}>
        {label}
      </span>
      {more && (
        <motion.span className="relative flex" initial={false} animate={{ rotate: open ? 180 : 0 }} transition={sceneTween}>
          <ChevronDown className="h-3 w-3 text-content-tertiary" />
        </motion.span>
      )}
    </div>
  );
}

export function FauxNavBar({ active, pinned, moreOpen }: { active: FauxTabKey; pinned: boolean; moreOpen: boolean }) {
  const { t } = useTranslation();
  const labels: Record<FauxTabKey, string> = {
    home: t("nav:home"),
    forYou: t("nav:forYou"),
    myList: t("nav:myList"),
    movies: t("search:movies"),
    series: t("search:series"),
    more: t("nav:more"),
  };
  return (
    <Place x={CAPSULE.x} y={CAPSULE.y} w={CAPSULE.w} h={CAPSULE.h}>
      <div className="absolute inset-0 rounded-[16px] bg-surface-1 opacity-75" />
      <div
        className="absolute inset-0 rounded-[16px]"
        style={{
          background: "var(--nav-capsule-bg)",
          border: "1px solid var(--nav-capsule-border)",
          boxShadow: "inset 0 1px 0 var(--nav-capsule-highlight), var(--nav-capsule-shadow)",
        }}
      />
      <span className="absolute left-2.5 top-[9px] flex">
        <TentacleLogo size="sm" variant="bare" />
      </span>
      <span className="absolute left-[42px] top-[13px] h-5 w-px bg-line-subtle" />
      {TABS.map(({ key, icon, slot }) => (
        <Place key={key} x={TAB_X + slot * TAB_STEP} y={6} w={TAB_W} h={34} dx={pinned && slot >= 2 ? TAB_STEP : 0}>
          <FauxTab icon={icon} label={labels[key]} active={active === key} open={key === "more" && moreOpen} more={key === "more"} />
        </Place>
      ))}
      {/* « Ma liste », épinglée : son onglet prend place après « Pour vous ». */}
      <Place x={TAB_X + 2 * TAB_STEP} y={6} w={TAB_W} h={34} visible={pinned} scale={pinned ? 1 : 0.85}>
        <FauxTab icon={Bookmark} label={labels.myList} active={active === "myList"} />
      </Place>
      <span className="absolute right-[42px] top-[10px] flex h-[26px] w-[26px] items-center justify-center text-content-secondary">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="absolute right-[10px] top-[10px] h-[26px] w-[26px] rounded-full ring-1 ring-line-subtle" style={{ background: CARD_TONES[0] }} />
    </Place>
  );
}
