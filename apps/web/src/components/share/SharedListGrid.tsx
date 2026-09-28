import type { SharedListItem } from "@tentacle-tv/api-client";
import { RevealCell, RevealScope } from "../grid/RevealCell";
import { SharedPosterCard } from "./SharedPosterCard";

/** Affiche 2:3 plus son bloc titre — hauteur réservée avant premier passage. */
const CELL_HEIGHT = 280;
const TEXT_HEIGHT = 52;

interface Props {
  items: SharedListItem[];
  authed: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** Token courant — pour ouvrir la fiche publique /share/:token/:id. */
  token: string;
}

/**
 * Grille d'une liste partagée. Toucher une affiche ouvre la fiche publique
 * (résumé, casting, informations, bandes-annonces — sans lecture) ; la case
 * de sélection, connecté seulement, prépare l'ajout à sa propre liste.
 *
 * Mêmes colonnes et même gouttière (16 px) que la grille de Ma liste.
 */
export function SharedListGrid({ items, authed, selected, onToggle, token }: Props) {
  return (
    // Une liste partagée n'est pas bornée : le contenu des cellules hors du
    // champ est démonté, leur place est gardée (cf. `RevealCell`).
    <RevealScope>
      <ul className="grid grid-cols-2 gap-4 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
        {items.map((item, index) => {
          const inLibrary = item.Id !== "";
          return (
            <li key={item.Id || `tmdb-${item.Name}-${index}`}>
              <RevealCell minHeight={CELL_HEIGHT} aspect={2 / 3} textHeight={TEXT_HEIGHT} eager={index < 12}>
                <SharedPosterCard
                  item={item}
                  to={inLibrary ? `/share/${token}/${item.Id}` : null}
                  selectable={authed && inLibrary}
                  selected={inLibrary && selected.has(item.Id)}
                  onToggle={onToggle}
                />
              </RevealCell>
            </li>
          );
        })}
      </ul>
    </RevealScope>
  );
}
