import { memo, useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface RightsGroupProps {
  title: string;
  /** L'état de la rubrique en une ligne, lisible fiche repliée. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Une rubrique des droits : son titre et l'état en une ligne, puis, ouverte,
 * ses réglages. Le contenu n'est MONTÉ qu'ouvert — rien à calculer ni à
 * peindre pour ce qu'on ne regarde pas.
 */
export const RightsGroup = memo(function RightsGroup({ title, summary, open, onToggle, children }: RightsGroupProps) {
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-content-primary">{title}</span>
          <span className="mt-0.5 line-clamp-2 text-xs text-content-tertiary">{summary}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-content-tertiary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={panelId} className="space-y-5 px-4 pb-5 pt-1">
          {children}
        </div>
      )}
    </div>
  );
});
