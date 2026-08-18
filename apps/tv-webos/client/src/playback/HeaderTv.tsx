import type { FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { BackIcon } from "@/components/PlayerIcons";
import { retenirBoutonOsd } from "./focusOsd";

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
 * Il porte `data-osd-bouton` comme les autres : le focus y revient si c'est de
 * là qu'on est parti.
 *
 * Sorti de `ControlsTv`, qui touchait les trois cents lignes.
 */

interface ProprietesEntete {
  titre: string;
  sousTitre?: string;
  onQuitter: () => void;
}

export function EnteteTv({ titre, sousTitre, onQuitter }: ProprietesEntete) {
  const { t } = useTranslation("player");

  // Même mémorisation que dans la rangée : `onFocus` remonte en React, et rien
  // ne subsiste quand l'habillage se démonte.
  const retenir = (evenement: FocusEvent<HTMLDivElement>): void => {
    const cible = evenement.target as HTMLElement;
    retenirBoutonOsd(cible.getAttribute("data-osd-bouton"));
  };

  return (
    <div className="osd-tv-haut" onFocus={retenir}>
      <button
        type="button"
        className="osd-tv-bouton osd-tv-quitter"
        data-osd-bouton="quitter"
        onClick={onQuitter}
        aria-label={t("player:back")}
      >
        <BackIcon />
      </button>

      <div className="osd-tv-textes">
        <h2 className="osd-tv-titre">{titre}</h2>
        {sousTitre && <p className="osd-tv-sous-titre">{sousTitre}</p>}
      </div>
    </div>
  );
}
