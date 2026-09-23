import { forwardRef, useId, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle, Search, X } from "lucide-react";
import { openOmnibox } from "./omniboxStore";

/**
 * La recherche DANS une page — une bibliothèque, Ma liste, Mes favoris — au
 * niveau de la barre de recherche globale :
 *
 * - l'icône prend la couleur de la marque au focus, le liseré aussi ;
 * - une croix efface d'un clic, Échap aussi (puis quitte le champ) ;
 * - pendant que la recherche part, un anneau tourne ; ensuite, le nombre de
 *   titres trouvés s'affiche au bout du champ — la réponse se voit avant
 *   même de regarder la grille ;
 * - ⌘K (Ctrl+K) depuis le champ relance le MÊME texte dans la recherche de
 *   tout Tentacle, qui tolère les fautes (`relayToOmnibox` : seulement là où
 *   l'on cherche des œuvres — pas des comptes ni des tickets).
 *
 * Fond de surface OPAQUE et liseré franc : le champ chevauche souvent le bas
 * d'une bannière, et une teinte translucide s'y perdait (voir l'historique de
 * `LibrarySearchField`).
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
      className={`group relative flex h-11 w-full items-center gap-2 rounded-full border border-line-strong bg-[color:var(--surface-2)] pl-4 pr-1.5 transition-colors duration-150 focus-within:border-[color:rgba(var(--brand-rgb),0.75)] focus-within:shadow-[0_0_0_3px_rgba(var(--brand-rgb),0.2)] ${className}`}
    >
      <Search
        aria-hidden
        strokeWidth={2.2}
        className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-[var(--brand-light)]" : "text-content-tertiary group-focus-within:text-[var(--brand-light)]"}`}
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
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:appearance-none"
      />
      {active && (
        <span id={statusId} aria-live="polite" className="flex h-8 shrink-0 items-center px-1 text-xs tabular-nums text-content-tertiary">
          {busy ? (
            <LoaderCircle aria-label={t("searching")} className="h-4 w-4 animate-spin text-[var(--brand-light)]" />
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
});
