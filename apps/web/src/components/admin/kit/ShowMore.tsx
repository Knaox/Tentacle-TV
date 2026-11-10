import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CaretDownIcon as ChevronDown } from "@phosphor-icons/react/dist/csr/CaretDown";

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
        className="btn btn-ghost btn-sm -ml-2 mt-2"
      >
        {open ? t("showLess") : label ?? t("showMore")}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-hover ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
