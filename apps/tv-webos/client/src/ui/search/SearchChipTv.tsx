import { forwardRef } from "react";

/**
 * Une pastille de recherche — récente, genre, studio. Un bouton : le moteur la
 * recense comme n'importe quelle cible, et l'appui passe par `click()`.
 *
 * `capitalize` : des genres Jellyfin arrivent en minuscules (« action ») — la
 * capitale n'est qu'à l'affichage, la recherche garde le nom exact. Une
 * recherche récente, elle, s'affiche telle qu'elle a été tapée.
 */
export const SearchChipTv = forwardRef<HTMLButtonElement, {
  label: string;
  detail?: string;
  capitalize?: boolean;
  onClick: () => void;
}>(function SearchChipTv({ label, detail, capitalize = false, onClick }, ref) {
  const shown = capitalize ? label.charAt(0).toLocaleUpperCase() + label.slice(1) : label;
  return (
    <button ref={ref} type="button" className="tv-search-chip" onClick={onClick}>
      <span className="tv-search-chip-label">{shown}</span>
      {detail && <span className="tv-search-chip-detail">{detail}</span>}
    </button>
  );
});
