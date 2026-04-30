import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface RowHeaderProps {
  title: string;
  /** Optional href for "Tout voir" link. Hidden until row hover. */
  href?: string;
}

export function RowHeader({ title, href }: RowHeaderProps) {
  const { t } = useTranslation("common");

  return (
    <div className="row-gutter mb-3 flex items-center gap-2">
      <h2 className="text-base font-semibold tracking-tight text-white md:text-lg">{title}</h2>
      {href && (
        <Link
          to={href}
          className="-translate-x-2 flex items-center gap-0.5 text-xs font-medium text-white/55 opacity-0 transition-all duration-300 hover:text-white group-hover/row:translate-x-0 group-hover/row:opacity-100"
        >
          {t("common:seeAll")}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
