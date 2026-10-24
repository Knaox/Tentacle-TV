/**
 * Octave — la barre de recherche : pendant la frappe, des SUGGESTIONS (texte
 * seulement, aucune recherche complète) ; Entrée, « Rechercher » ou une
 * suggestion choisie lancent la recherche. Combobox ARIA comme l'omnibox de
 * Tentacle : le champ garde le focus, les flèches parcourent la liste
 * (`aria-activedescendant`), Échap la ferme. La liste n'existe que montrée
 * (son flou d'arrière-plan ne coûte rien quand elle est fermée). Et comme
 * l'omnibox, la barre COMPLÈTE : la suite de la première suggestion qui
 * commence par la frappe s'inscrit en gris après le curseur (⇥ ou → l'accepte).
 */

import { memo, useCallback, useState, type KeyboardEvent } from "react";
import { Clock, Disc3, Music, Search, User, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inlineCompletion } from "@tentacle-tv/shared";
import { moveActive, type OctaveSuggestion } from "./suggestionModel";

const LIST_ID = "octave-search-suggestions";
const ICONS = { recent: Clock, artist: User, track: Music, album: Disc3 } as const;

interface OctaveSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Lance la recherche complète de ce texte. */
  onSubmit: (text: string) => void;
  suggestions: readonly OctaveSuggestion[];
  onForget: (text: string) => void;
}

export const OctaveSearchBox = memo(function OctaveSearchBox({ value, onChange, onSubmit, suggestions, onForget }: OctaveSearchBoxProps) {
  const { t } = useTranslation("music");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = open && suggestions.length > 0;
  const activeId = shown && active >= 0 && active < suggestions.length ? `${LIST_ID}-${active}` : undefined;
  // La suite proposée : jamais une réécriture de ce qui est tapé, seulement ce qui le prolonge.
  const completion = shown && active < 0 ? (suggestions.map((s) => inlineCompletion(value, s.text)).find((c) => c !== null) ?? null) : null;

  const submit = useCallback(
    (text: string) => {
      setOpen(false);
      setActive(-1);
      if (text.trim()) onSubmit(text.trim());
    },
    [onSubmit],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "ArrowRight") && completion !== null && !e.shiftKey && e.currentTarget.selectionStart === value.length) {
      e.preventDefault();
      onChange(value + completion);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => moveActive(a, suggestions.length, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(activeId ? suggestions[active].text : value);
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="relative flex max-w-2xl items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-content-tertiary" aria-hidden />

        <input
          id="octave-search"
          type="search"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={t("search.placeholder")}
          role="combobox"
          aria-label={t("search.title")}
          aria-expanded={shown}
          aria-controls={LIST_ID}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          className="h-12 w-full rounded-full border border-line-subtle bg-fill-subtle pl-12 pr-12 text-base text-content-primary placeholder:text-content-quaternary focus:border-line-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {completion !== null && (
          // Calque PAR-DESSUS le champ (sans pointeur), même boîte : le texte tapé y est invisible, la suite visible après le curseur.
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-full border border-transparent pl-12 pr-12 text-base">
            <span className="invisible">{value}</span>
            <span className="text-content-quaternary">{completion}</span>
          </div>
        )}
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(true);
            }}
            aria-label={t("search.clear")}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {shown && (
          <ul
            id={LIST_ID}
            role="listbox"
            aria-label={t("search.suggestions")}
            // Un clic dans la liste ne fait pas perdre le focus au champ (et ne ferme donc pas la liste avant le choix).
            onMouseDown={(e) => e.preventDefault()}
            className="lg-menu absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden p-1.5"
            style={{
              background: "var(--surface-dropdown)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-dropdown)",
              backdropFilter: "blur(var(--blur-dropdown))",
              WebkitBackdropFilter: "blur(var(--blur-dropdown))",
            }}
          >
            {suggestions.map((s, i) => {
              const Icon = ICONS[s.kind];
              return (
                <li
                  key={s.id}
                  id={`${LIST_ID}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => submit(s.text)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 text-sm ${i === active ? "bg-fill-subtle" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-content-primary">
                    {s.title}
                    {s.subtitle && <span className="text-content-tertiary"> · {s.subtitle}</span>}
                  </span>
                  {s.kind === "recent" && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onForget(s.text);
                      }}
                      aria-label={t("search.forget", { query: s.text })}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-quaternary hover:text-content-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => submit(value)}
        disabled={!value.trim()}
        className="h-12 shrink-0 cursor-pointer rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:opacity-40"
      >
        {t("search.submit")}
      </button>
    </div>
  );
});
