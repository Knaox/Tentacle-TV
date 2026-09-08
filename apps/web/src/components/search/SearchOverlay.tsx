import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSearchItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SearchSuggestions } from "./SearchSuggestions";
import { pushRecentSearch, readRecentSearches } from "./recentSearches";
import { SearchResultCard } from "./SearchResultCard";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen, blurred-black search experience.
 * Replaces the legacy inline dropdown — cleaner, more cinematic,
 * and lets the input go genuinely large for thumb-friendly mobile typing.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { t } = useTranslation("common");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce input (350ms) so we don't fire a search on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebounced(input.trim()), 350);
    return () => clearTimeout(id);
  }, [input]);

  // Auto-focus input when overlay opens; reset query on close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setInput("");
      setDebounced("");
    }
  }, [open]);

  const { data: results, isLoading } = useSearchItems(debounced);
  const visibleResults = results?.slice(0, 24) ?? [];

  // Relues à chaque ouverture : l'utilisateur a pu chercher depuis un autre
  // onglet entre-temps, et la liste est de toute façon lue depuis le disque.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    if (open) setRecent(readRecentSearches());
  }, [open]);

  const handleSelect = (it: MediaItem) => {
    // Mémorisée à la SÉLECTION, pas à la frappe : une requête abandonnée en
    // cours de route n'a rien donné, la ressortir en suggestion serait un
    // mauvais conseil. Ce qui a mené à un média, en revanche, a fait ses
    // preuves.
    pushRecentSearch(debounced);
    onClose();
    navigate(`/media/${it.Id}`);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        // Takeover plein ecran en texte theme : son fond suit le schema.
        // Le rgba(0,0,0,0.92) fige donnait une page 100 % noire en clair.
        background: "rgba(var(--scrim-page-rgb), 0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        animation: "fadeIn 200ms ease-out",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("common:searchPlaceholder")}
      onClick={onClose}
    >
      {/* Header — input + close */}
      <div
        className="row-gutter flex items-center gap-4 border-b border-line-subtle py-5"
        onClick={(e) => e.stopPropagation()}
        // `--hote-bandeau` : la bande de fenêtre que la page dessine elle-même
        // sur la coquille Electron macOS. Le `padding-top` du `body` la
        // compense pour le flux normal, mais cet en-tête vit dans un portail en
        // `position: fixed` — il se repère sur la FENÊTRE et passait donc sous
        // la bande, qui coupait le champ de saisie en deux. La bande garde son
        // z-index au-dessus : c'est la seule prise pour déplacer la fenêtre
        // pendant la recherche. Vaut `0px` partout ailleurs.
        style={{ paddingTop: "calc(1.25rem + var(--hote-bandeau) + env(safe-area-inset-top, 0px))" }}
      >
        <SearchIcon className="h-6 w-6 flex-shrink-0 text-content-tertiary" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("common:searchMediaLong")}
          className="flex-1 bg-transparent text-2xl font-light text-content-primary placeholder-content-quaternary outline-none md:text-3xl"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Results body */}
      <div
        className="row-gutter flex-1 overflow-y-auto pb-12 pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Écran d'attente : recherches récentes, reprise, prochains épisodes.
            Il n'y avait qu'un « Rechercher... » centré — un plein écran vide,
            ouvert par un raccourci clavier, qui ne proposait rien. */}
        {debounced.length < 2 && (
          <SearchSuggestions
            recent={recent}
            onRecentChange={setRecent}
            onPickQuery={(q) => { setInput(q); setDebounced(q); }}
            renderItems={(items) => <ResultsGrid items={items} onSelect={handleSelect} />}
          />
        )}

        {debounced.length >= 2 && isLoading && (
          <div className="flex justify-center pt-12">
            {/* Spinner posé sur le fond figé rgba(0,0,0,0.92) ci-dessus : reste blanc. */}
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          </div>
        )}

        {debounced.length >= 2 && !isLoading && (!results || results.length === 0) && (
          <p className="pt-12 text-center text-sm text-content-quaternary">{t("common:noResults")}</p>
        )}

        {debounced.length >= 2 && visibleResults.length > 0 && (
          <ResultsGrid items={visibleResults} onSelect={handleSelect} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function ResultsGrid({
  items,
  onSelect,
}: {
  items: MediaItem[];
  onSelect: (it: MediaItem) => void;
}) {
  return (
    <ul
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
    >
      {items.map((it, i) => (
        <SearchResultCard key={it.Id} item={it} index={i} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
