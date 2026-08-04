import { useEffect, useRef } from "react";
import { inscrireRetour } from "../../focus/retour";

/**
 * Le choix d'une valeur, en surcouche, pilotable à la télécommande.
 *
 * Il remplace le `<select>` du client web. Un `<select>` natif n'est pas
 * inutilisable sur une dalle — webOS lui ouvre un sélecteur système — mais on
 * n'en maîtrise alors ni le focus, ni le retour, ni l'apparence, et il apparaît
 * au milieu d'une interface qui a les siens. Trente-huit langues méritent mieux
 * qu'une boîte système posée par-dessus.
 *
 * `role="dialog"` n'est pas décoratif : `focus/candidats.ts` reconnaît ce rôle
 * et **confine le déplacement** à l'intérieur. Sans lui, le D-pad sortirait du
 * panneau par le bas et irait viser les boutons de la page qui le porte, sous
 * un calque qu'on ne voit plus. C'est le même mécanisme que pour les menus de
 * bibliothèque, à ceci près qu'eux ne le déclarent pas.
 *
 * La touche Retour ferme, avant de reculer d'un écran : la pile de
 * consommateurs de `focus/retour.ts` est faite pour ça.
 */

export interface ChoixTv {
  valeur: string;
  libelle: string;
}

interface ProprietesPanneauChoixTv {
  titre: string;
  choix: ChoixTv[];
  /** La valeur en cours — c'est elle qui reçoit le focus à l'ouverture. */
  selection: string | null;
  onChoisir: (valeur: string) => void;
  onFermer: () => void;
}

export function PanneauChoixTv({
  titre,
  choix,
  selection,
  onChoisir,
  onFermer,
}: ProprietesPanneauChoixTv) {
  const selectionne = useRef<HTMLButtonElement | null>(null);

  // Le focus part sur la valeur en cours, comme le fait `SelectionModal`
  // d'`apps/tv` : on arrive là où l'on est, pas en haut d'une liste de
  // trente-huit entrées qu'il faudrait redescendre.
  useEffect(() => {
    selectionne.current?.focus();
  }, []);

  useEffect(() => inscrireRetour(() => {
    onFermer();
    return true;
  }), [onFermer]);

  return (
    <div className="panneau-choix-tv" role="dialog" aria-label={titre}>
      <div className="panneau-choix-tv-boite">
        <p className="panneau-choix-tv-titre">{titre}</p>
        <ul className="panneau-choix-tv-liste">
          {choix.map((entree) => {
            const actif = entree.valeur === selection;
            return (
              <li key={entree.valeur}>
                <button
                  type="button"
                  ref={actif ? selectionne : undefined}
                  data-actif={actif}
                  className="panneau-choix-tv-entree"
                  onClick={() => onChoisir(entree.valeur)}
                >
                  {entree.libelle}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
