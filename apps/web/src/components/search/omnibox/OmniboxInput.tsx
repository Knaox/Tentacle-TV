/**
 * La saisie de l'omnibox : grande, calme, et qui COMPLÈTE — la suite du titre
 * le plus probable s'inscrit en gris après le curseur (⇥ ou → pour
 * l'accepter), comme le fait la barre de Google.
 *
 * La suite est un calque sous le champ, dans la même fonte au pixel près : le
 * texte tapé y est invisible (il ne sert qu'à décaler), la suite visible. Elle
 * ne s'affiche que si le titre COMMENCE par la saisie (`inlineCompletion`) —
 * jamais une réécriture de ce qui a été tapé.
 *
 * Combobox ARIA : le champ garde le focus, la liste est désignée par
 * `aria-activedescendant` — le lecteur d'écran suit la sélection au clavier.
 */

import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { forwardRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

interface OmniboxInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** La suite proposée, déjà tapée exclue. */
  completion: string | null;
  activeDescendant: string | undefined;
  expanded: boolean;
  fetching: boolean;
  onClose: () => void;
  compact: boolean;
}

const FONT = "text-[17px] leading-6 tracking-[-0.005em]";

export const OmniboxInput = forwardRef<HTMLInputElement, OmniboxInputProps>(function OmniboxInput(
  { value, onChange, onKeyDown, completion, activeDescendant, expanded, fetching, onClose, compact },
  ref,
) {
  const { t } = useTranslation("search");
  return (
    <div className="lg-sep relative flex h-16 shrink-0 items-center gap-3 border-b border-line-subtle px-4 sm:px-5">
      <MagnifyingGlassIcon size={20} aria-hidden className="shrink-0 text-content-secondary" />
      <div className="relative min-w-0 flex-1">
        {completion !== null && (
          <div aria-hidden className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre ${FONT}`}>
            <span className="invisible">{value}</span>
            <span className="text-content-quaternary">{completion}</span>
          </div>
        )}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          role="combobox"
          aria-label={t("dialog")}
          aria-expanded={expanded}
          aria-controls="omnibox-listbox"
          aria-activedescendant={activeDescendant}
          aria-autocomplete="both"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className={`relative w-full bg-transparent text-content-primary outline-none placeholder:text-content-tertiary ${FONT}`}
        />
      </div>
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clear")}
          title={t("clear")}
          className="icon-btn btn-sm"
        >
          <XIcon size={16} weight="bold" aria-hidden />
        </button>
      )}
      {compact ? (
        <button type="button" onClick={onClose} className="btn btn-sm btn-ghost shrink-0">
          {t("cancel")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="ui-kbd shrink-0 transition-colors duration-hover hover:text-content-primary"
        >
          {t("escape")}
        </button>
      )}
      {fetching && (
        <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[2px] overflow-hidden">
          <span className="omnibox-progress absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
        </span>
      )}
    </div>
  );
});
