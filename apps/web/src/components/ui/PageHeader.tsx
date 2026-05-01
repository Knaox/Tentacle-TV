import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  /** Subtitle (count, library type, etc.). */
  subtitle?: ReactNode;
  /** Show a back button on the left. */
  backTo?: string | -1;
  /** Right-side actions slot (filter button, sort dropdown, etc.). */
  actions?: ReactNode;
  /** Larger hero treatment with gradient + bigger title. Default false (compact). */
  hero?: boolean;
  className?: string;
}

/**
 * Unified page header — replaces inline `<h1>` patterns scattered across
 * Library / Watchlist / Favorites / Settings / Admin. Provides consistent
 * spacing, optional back button, optional right-side actions.
 */
export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  hero = false,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={`row-gutter flex items-end justify-between gap-4 ${
        hero ? "pt-12 pb-8" : "pt-8 pb-5"
      } ${className ?? ""}`}
    >
      <div className="flex min-w-0 items-center gap-4">
        {backTo !== undefined && (
          <button
            type="button"
            onClick={() =>
              backTo === -1 ? navigate(-1) : navigate(backTo as string)
            }
            aria-label="Retour"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1
            className={`truncate font-bold tracking-tight text-white ${
              hero ? "text-display-3 md:text-display-2" : "text-2xl md:text-3xl"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1.5 text-sm text-white/55">{subtitle}</div>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
