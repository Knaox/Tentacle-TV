import { useEffect, useRef } from "react";
import { registerBack } from "../../focus/back";

/**
 * Le choix d'une valeur, en surcouche, pilotable à la télécommande.
 *
 * Il remplace le `<select>` du client web. Un `<select>` natif n'est pas
 * inutilisable sur une dalle — webOS lui ouvre un sélecteur système — mais on
 * n'en maîtrise alors ni le focus, ni le retour, ni l'apparence, et il apparaît
 * au milieu d'une interface qui a les siens. Trente-huit langues méritent mieux
 * qu'une boîte système posée par-dessus.
 *
 * `role="dialog"` n'est pas décoratif : `focus/candidates.ts` reconnaît ce rôle
 * et **confine le déplacement** à l'intérieur. Sans lui, le D-pad sortirait du
 * panneau par le bas et irait viser les boutons de la page qui le porte, sous
 * un calque qu'on ne voit plus. C'est le même mécanisme que pour les menus de
 * bibliothèque, à ceci près qu'eux ne le déclarent pas.
 *
 * La touche Retour ferme, avant de reculer d'un écran : la pile de
 * consommateurs de `focus/back.ts` est faite pour ça.
 */

export interface ChoiceTv {
  value: string;
  label: string;
}

interface ChoicePanelTvProps {
  title: string;
  choice: ChoiceTv[];
  /** La valeur en cours — c'est elle qui reçoit le focus à l'ouverture. */
  selection: string | null;
  onChoose: (value: string) => void;
  onClose: () => void;
}

export function ChoicePanelTv({
  title,
  choice,
  selection,
  onChoose,
  onClose,
}: ChoicePanelTvProps) {
  const selected = useRef<HTMLButtonElement | null>(null);

  // Le focus part sur la valeur en cours, comme le fait `SelectionModal`
  // d'`apps/tv` : on arrive là où l'on est, pas en haut d'une liste de
  // trente-huit entrées qu'il faudrait redescendre.
  useEffect(() => {
    selected.current?.focus();
  }, []);

  useEffect(() => registerBack(() => {
    onClose();
    return true;
  }), [onClose]);

  return (
    <div className="panneau-choix-tv" role="dialog" aria-label={title}>
      <div className="panneau-choix-tv-boite">
        <p className="panneau-choix-tv-titre">{title}</p>
        <ul className="panneau-choix-tv-liste">
          {choice.map((entree) => {
            const active = entree.value === selection;
            return (
              <li key={entree.value}>
                <button
                  type="button"
                  ref={active ? selected : undefined}
                  data-active={active}
                  className="panneau-choix-tv-entree"
                  onClick={() => onChoose(entree.value)}
                >
                  {entree.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
