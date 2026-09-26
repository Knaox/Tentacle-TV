import { forwardRef, memo, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownRight, Search, X } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";

interface Props {
  value: string;
  /** La suite grise du meilleur titre, `null` sans rien à proposer. */
  completion: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
}

/**
 * iOS agrandit la page quand un champ de moins de 16 px prend le focus. Le
 * champ de l'app est en 15 : on le compose en 16 et on le ramène à 15 par une
 * échelle (transform seulement), le texte fantôme avec lui — même rendu, pas
 * de zoom.
 */
const SCALE = 15 / 16;
const TEXT = "text-base font-normal tracking-[-0.107px]";

/**
 * Les boutons du champ ne lui volent pas le focus (`keyboardShouldPersistTaps`
 * de l'app) : sinon le clavier se range, et la complétion — qui ne vit que
 * champ actif — disparaît avant que le toucher n'arrive au bouton.
 */
const keepFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

/**
 * Le champ de `SearchScreen` de l'app et son `AssistedInput` : boîte de 46 de
 * haut, rayon 12, `fill.soft` bordé de `border.subtle`, 12 de marge et 8 entre
 * les éléments — loupe 16, saisie 15, la complétion fantôme en quaternaire
 * derrière le curseur (le geste ↳ ou ⇥ l'accepte), l'indicateur de recherche,
 * puis l'effacement : un rond de 22 `fill.medium` à croix 14.
 */
export const SearchField = memo(forwardRef<HTMLInputElement, Props>(function SearchField(
  { value, completion, busy, onChange, onSubmit, onClear, onFocusChange },
  ref,
) {
  const { t } = useTranslation("search");
  const accept = () => {
    if (completion !== null) onChange(value + completion);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab" && completion !== null && !event.shiftKey) {
      event.preventDefault();
      accept();
    } else if (event.key === "Enter") {
      // Le « Rechercher » du clavier : retenir la requête et ranger le clavier.
      onSubmit();
      event.currentTarget.blur();
    }
  };

  return (
    <div className="flex h-[46px] min-w-0 flex-1 items-center gap-2 rounded-xl border border-line-subtle bg-fill-soft px-3">
      <Search size={16} className="shrink-0 text-content-tertiary" aria-hidden />
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: `${100 / SCALE}%`, height: `${100 / SCALE}%`, transform: `scale(${SCALE})` }}
        >
          {completion !== null && (
            <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre ${TEXT}`}>
              <span className="text-transparent">{value}</span>
              <span className="text-content-quaternary">{completion}</span>
            </span>
          )}
          <input
            ref={ref}
            type="search"
            enterKeyHint="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            placeholder={t("placeholder")}
            aria-label={t("dialog")}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={`relative h-full w-full appearance-none bg-transparent p-0 text-content-primary outline-none placeholder:text-content-quaternary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none ${TEXT}`}
          />
        </div>
      </div>
      {completion !== null && (
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={accept}
          aria-label={t("hintComplete")}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-brand-light"
        >
          <CornerDownRight size={16} aria-hidden />
        </button>
      )}
      {busy && <Spinner size="sm" tone="neutral" className="shrink-0" />}
      {value.length > 0 && (
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={onClear}
          aria-label={t("clear")}
          className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-fill-medium text-content-tertiary before:absolute before:-inset-2.5 before:content-['']"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}));
