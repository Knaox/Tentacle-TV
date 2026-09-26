import { useTranslation } from "react-i18next";
import { BackIcon } from "@/components/PlayerIcons";

/**
 * La tête de l'habillage : de quoi savoir ce qu'on regarde, et comment sortir.
 *
 * **Le bouton quitter.** Sortir d'un épisode ne tenait qu'à la touche Retour de
 * la télécommande — qui fonctionne, mais que rien à l'écran ne nomme. Une
 * commande physique se devine d'autant moins qu'aucune trace visible ne la
 * rappelle ; c'est le genre d'absence dont on ne se plaint pas, on referme
 * l'application. L'Apple TV (`TVPlayerOverlay`) et le client web
 * (`PlayerControls`) posent tous deux ce bouton au même endroit : en tête, à
 * gauche du titre. On les suit — la rangée de transport n'a pas à s'allonger
 * pour ça, et la zone haute était jusqu'ici la seule du lecteur qu'on ne
 * pouvait pas atteindre.
 *
 * **Il n'est jamais l'entrée de l'habillage**, ni retenu comme dernier bouton
 * visé (`focusOsd.ts`) : on ne le vise pas pour y revenir, on le vise pour
 * partir. L'anneau qui y reparaissait faisait d'un OK — le geste qu'on fait
 * pour mettre en pause — une sortie du lecteur.
 *
 * Sorti de `ControlsTv`, qui touchait les trois cents lignes.
 */

interface HeaderProps {
  title: string;
  subtitle?: string;
  onExit: () => void;
}

export function HeaderTv({ title, subtitle, onExit }: HeaderProps) {
  const { t } = useTranslation("player");

  return (
    <div className="osd-tv-haut">
      <button
        type="button"
        className="osd-tv-bouton osd-tv-quitter"
        onClick={onExit}
        aria-label={t("player:back")}
      >
        <BackIcon />
      </button>

      <div className="osd-tv-textes">
        <h2 className="osd-tv-titre">{title}</h2>
        {subtitle && <p className="osd-tv-sous-titre">{subtitle}</p>}
      </div>
    </div>
  );
}
