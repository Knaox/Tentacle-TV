import { motion } from "framer-motion";
import { CARD_TONES } from "./FauxCard";
import { Place, type Animated, type Placed } from "./Place";
import { sceneTween } from "./sceneMotion";

interface FauxChipProps extends Placed, Animated {
  label: string;
  /** Sélectionnée : le calque de marque se révèle en opacité (jamais un fond animé). */
  selected?: boolean;
  icon?: "check" | "play" | "x" | "filter";
  /** Un rond de couleur avant le libellé : logo de service factice (une lettre). */
  logo?: string;
  logoTone?: number;
  size?: "sm" | "md";
}

const ICONS: Record<NonNullable<FauxChipProps["icon"]>, string> = {
  check: "M5 12.5l4 4L19 7",
  play: "M8 5v14l11-7z",
  x: "M6 6l12 12M18 6L6 18",
  filter: "M4 6h16M7 12h10M10 18h4",
};

/** Une pastille : filtre, badge, bouton — le même objet que dans l'app, en faux. */
export function FauxChip({ label, selected = false, icon, logo, logoTone = 0, size = "md", ...place }: FauxChipProps) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[12px]";
  return (
    <Place {...place}>
      <span
        className={`relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-line-subtle bg-fill-soft font-medium ${pad}`}
        style={{ color: selected ? "var(--brand)" : "var(--text-secondary)" }}
      >
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[var(--brand-soft)] ring-1 ring-inset ring-[rgba(var(--brand-rgb),0.5)]"
          initial={false}
          animate={{ opacity: selected ? 1 : 0 }}
          transition={sceneTween}
        />
        {logo && (
          <span
            className="relative grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold leading-none text-white"
            style={{ background: CARD_TONES[logoTone % CARD_TONES.length] }}
          >
            {logo}
          </span>
        )}
        {icon && (
          <svg viewBox="0 0 24 24" className="relative h-3.5 w-3.5" fill={icon === "play" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.2}>
            <path d={ICONS[icon]} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="relative leading-none">{label}</span>
      </span>
    </Place>
  );
}
