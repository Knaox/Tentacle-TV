import { forwardRef, useId, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CircleNotchIcon as LoaderCircle } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import { openOmnibox } from "./omniboxStore";

/**
 * La recherche DANS une page — une bibliothèque, Ma liste, Mes favoris — au
 * niveau de la barre de recherche globale :
 *
 * - l'icône s'éclaire au focus, et le champ prend l'anneau du socle (`.field`,
 *   à la teinte franche) ;
 * - une croix efface d'un clic, Échap aussi (puis quitte le champ) ;
 * - pendant que la recherche part, un anneau tourne ; ensuite, le nombre de
 *   titres trouvés s'affiche au bout du champ — la réponse se voit avant
 *   même de regarder la grille ;
 * - ⌘K (Ctrl+K) depuis le champ relance le MÊME texte dans la recherche de
 *   tout Tentacle, qui tolère les fautes (`relayToOmnibox` : seulement là où
 *   l'on cherche des œuvres — pas des comptes ni des tickets).
 *
 * La pilule de recherche du socle (`field field-pill`), sur un fond de surface
 * OPAQUE : le champ chevauche parfois le bas d'une bannière, et une teinte
 * translucide s'y perdait (voir l'historique de `LibrarySearchField`).
 */

interface ScopedSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Titres trouvés pour la recherche en cours — `null` : rien à dire. */
  resultCount?: number | null;
  /** Une recherche est en route (saisie pas encore partie, requête en vol). */
  busy?: boolean;
  /** ⌘K depuis le champ ouvre l'omnibox avec ce texte. */
  relayToOmnibox?: boolean;
  className?: string;
}

export const ScopedSearchField = forwardRef<HTMLInputElement, ScopedSearchFieldProps>(function ScopedSearchField(
  { value, onChange, placeholder, resultCount = null, busy = false, relayToOmnibox = false, className = "" },
  ref,
) {
  const { t } = useTranslation("common");
  const statusId = useId();
  const active = value.trim().length > 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (value !== "") {
        event.preventDefault();
        onChange("");
      } else {
        event.currentTarget.blur();
      }
      return;
    }
    // ⌘K depuis le champ : le texte tapé suit dans l'omnibox. `stopPropagation`
    // empêche le raccourci global de l'ouvrir une seconde fois, à vide.
    if (relayToOmnibox && active && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      event.stopPropagation();
      openOmnibox(value.trim());
    }
  };

  return (
    <div
      role="search"
      className={`lg-field field field-pill group relative flex items-center gap-2 bg-surface-2 pl-3.5 pr-1 focus-within:shadow-[inset_0_0_0_1.5px_var(--accent),0_0_0_3px_rgba(var(--accent-rgb),0.22)] ${className}`}
    >
      <Search
        aria-hidden
        size={16}
        className={`shrink-0 transition-colors duration-hover ${active ? "text-content-primary" : "text-content-tertiary group-focus-within:text-content-primary"}`}
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-describedby={active ? statusId : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:appearance-none"
      />
      {active && (
        <span id={statusId} aria-live="polite" className="flex h-8 shrink-0 items-center px-1 text-xs tabular-nums text-content-tertiary">
          {busy ? (
            <LoaderCircle aria-label={t("searching")} size={16} className="animate-spin text-content-secondary motion-reduce:animate-none" />
          ) : resultCount !== null ? (
            t("searchResultCount", { count: resultCount })
          ) : null}
        </span>
      )}
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clearSearch")}
          title={t("clearSearch")}
          className="icon-btn btn-sm"
        >
          <X aria-hidden size={16} />
        </button>
      )}
    </div>
  );
});
