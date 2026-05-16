import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** CTA button slot. */
  action?: ReactNode;
  className?: string;
}

/**
 * Unified empty-state — replaces "no items" / "no results" inline blocks.
 * Centered icon + title + description + CTA, with subtle entry animation.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      className={`mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center ${className ?? ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {icon && (
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: "var(--brand-soft)",
            border: "1px solid rgba(var(--brand-rgb), 0.25)",
            color: "var(--brand-light)",
          }}
        >
          {icon}
        </div>
      )}
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-white/60">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
