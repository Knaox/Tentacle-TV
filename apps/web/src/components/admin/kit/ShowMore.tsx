import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

/**
 * « Voir plus » : ce qu'on ne lit qu'en cas de besoin, replié derrière un
 * bouton. Les pages d'administration montrent d'abord ce qui demande un
 * geste (un problème, un réglage à faire) ; le détail qui va bien — tableaux
 * entiers, réglages déjà en place, explications longues — attend qu'on le
 * demande. Une page de six écrans que personne ne lisait en tient deux.
 *
 * Monté à la demande : replié, le détail ne coûte aucun rendu.
 */
export interface ShowMoreProps {
  /** Le bouton replié : ce qu'on va voir (« Voir les 31 fonctionnalités »). Par défaut « Voir plus ». */
  label?: string;
  /** Déplié d'emblée — une ancre qui vise ce détail. */
  defaultOpen?: boolean;
  /** Classes de l'enveloppe (marges). */
  className?: string;
  children: ReactNode;
}

export function ShowMore({ label, defaultOpen = false, className = "", children }: ShowMoreProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <div id={id} hidden={!open}>
        {open ? children : null}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {open ? t("showLess") : label ?? t("showMore")}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
