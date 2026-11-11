import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { duration, easeOut } from "../../theme/motion";

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
 * Centered icon + title + description + CTA ; il paraît en fondu (220 ms), sans glisser.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      className={`mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center ${className ?? ""}`}
      // Un fondu, sans glissement : un écran qui dit « rien ici » n'a pas à arriver d'en bas.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: duration.base, ease: easeOut }}
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
      <h2 className="text-xl font-semibold text-content-primary">{title}</h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-content-tertiary">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
