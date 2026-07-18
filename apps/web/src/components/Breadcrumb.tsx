import { Link } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-content-quaternary" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronIcon />}
          {item.path ? (
            <Link to={item.path} className="transition-colors hover:text-content-secondary">
              {item.label}
            </Link>
          ) : (
            <span className="text-content-tertiary">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 text-content-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
