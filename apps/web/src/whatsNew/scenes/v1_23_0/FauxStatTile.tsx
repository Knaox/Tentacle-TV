import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Place, sceneTween, type Placed } from "..";

/**
 * Une tuile de chiffre de l'administration, en faux : même anatomie que
 * `StatTile` (icône teintée, étiquette, grand nombre, ligne de contexte) et
 * mêmes jetons, à l'échelle du canevas. Le survol est un calque révélé en
 * opacité ; la valeur attend son squelette tant que `loading`.
 */

export type FauxStatTone = "default" | "warning" | "brand";

const ICON_TONE: Record<FauxStatTone, string> = {
  default: "bg-fill-soft text-content-secondary",
  warning: "bg-status-warning-bg text-status-warning-fg",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-light)]",
};

interface FauxStatTileProps extends Placed {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: FauxStatTone;
  loading?: boolean;
  hovered?: boolean;
}

export function FauxStatTile({ label, value, hint, icon, tone = "default", loading = false, hovered = false, ...place }: FauxStatTileProps) {
  return (
    <Place {...place}>
      <div className="relative h-full overflow-hidden rounded-xl border border-line-subtle bg-fill-faint p-3">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-xl border border-line-strong bg-fill-subtle"
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={sceneTween}
        />
        <div className="relative flex h-6 items-center gap-2">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5 ${ICON_TONE[tone]}`}>
            {icon}
          </span>
          {/* Deux lignes au plus, comme la vraie tuile : « Mises à jour de plugins » ne se tronque pas. */}
          <span className="line-clamp-2 min-w-0 flex-1 text-[10px] font-medium leading-tight text-content-secondary">{label}</span>
        </div>
        <div className="relative mt-2 h-[38px]">
          <motion.div className="absolute inset-0 space-y-1.5" initial={false} animate={{ opacity: loading ? 1 : 0 }} transition={sceneTween}>
            <div className="h-5 w-10 rounded-md bg-fill-soft" />
            <div className="h-2 w-20 rounded bg-fill-soft" />
          </motion.div>
          <motion.div className="absolute inset-0" initial={false} animate={{ opacity: loading ? 0 : 1 }} transition={sceneTween}>
            <p className={`text-[22px] font-semibold leading-none tabular-nums ${tone === "warning" ? "text-status-warning-fg" : "text-content-primary"}`}>
              {value}
            </p>
            {hint && <p className="mt-1.5 truncate text-[9.5px] text-content-tertiary">{hint}</p>}
          </motion.div>
        </div>
      </div>
    </Place>
  );
}
