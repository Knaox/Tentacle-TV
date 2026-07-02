import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsibleSectionProps {
  title: string;
  /** Compteur affiché à côté du titre (ex. nombre d'appareils). */
  count?: number;
  /** Fermée par défaut — progressive disclosure. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Section repliable générique (liste déroulante) : en-tête cliquable avec
 * compteur + chevron pivotant, corps animé en hauteur. Se place à l'intérieur
 * d'une carte existante (le style de carte reste au parent).
 */
export function CollapsibleSection({ title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-md"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-lg font-semibold text-white">{title}</span>
          {count != null && (
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/70">
              {count}
            </span>
          )}
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
