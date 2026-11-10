import { Link } from "react-router-dom";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";

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
            <Link to={item.path} className="transition-colors duration-hover hover:text-content-secondary">
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
  return <CaretRightIcon size={12} weight="bold" className="text-content-disabled" aria-hidden />;
}
