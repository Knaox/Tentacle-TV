/**
 * Octave — le menu « Trier par » d'une liste : un choix par tri (cochable,
 * `menuitemradio`), puis les deux sens du tri choisi, dits en mots
 * (« Plus récents d'abord », « A → Z ») — jamais une flèche seule.
 * « Personnalisé » n'a pas de sens : c'est l'ordre qu'on a glissé.
 */

import { useRef, useState } from "react";
import { ArrowDownUp, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MUSIC_LIST_SORT_KEYS, defaultDirection, type MusicListDirection, type MusicListPrefs, type MusicListSortKey } from "@tentacle-tv/shared/music";
import { FloatingLayer } from "../../../components/floating/FloatingLayer";

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-content-primary hover:bg-octave-hover focus-visible:bg-octave-hover focus-visible:outline-none";

interface SortMenuProps {
  prefs: MusicListPrefs;
  /** Les tris offerts (sans écoutes connues, ni « Nombre d'écoutes » ni « Dernière écoute »). */
  sorts?: readonly MusicListSortKey[];
  onSort: (sort: MusicListSortKey, direction: MusicListDirection) => void;
}

export function SortMenu({ prefs, sorts = MUSIC_LIST_SORT_KEYS, onSort }: SortMenuProps) {
  const { t } = useTranslation("music");
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const label = t(`listOrder.sort.${prefs.sort}`);
  const pick = (sort: MusicListSortKey, direction: MusicListDirection) => {
    onSort(sort, direction);
    setOpen(false);
  };
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("listOrder.sortButton", { sort: label })}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus aria-expanded:bg-fill-subtle"
      >
        <span className="max-w-[10rem] truncate">{label}</span>
        <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {open && (
        <FloatingLayer
          open
          anchor={anchor}
          onDismiss={() => setOpen(false)}
          role="menu"
          ariaLabel={t("listOrder.sortMenu")}
          side="bottom"
          align="end"
          className="w-64 overflow-y-auto overscroll-contain p-1.5"
          style={{ background: "var(--oc-ink-raised)", borderRadius: "var(--oc-radius-panel)", boxShadow: "var(--oc-shadow-panel)", maxHeight: 460 }}
        >
          <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-content-quaternary" aria-hidden>
            {t("listOrder.sortMenu")}
          </div>
          {sorts.map((sort) => (
            <button
              key={sort}
              type="button"
              role="menuitemradio"
              aria-checked={prefs.sort === sort}
              // Choisir un AUTRE tri le prend dans son sens naturel ; le même garde le sens actuel.
              onClick={() => pick(sort, sort === prefs.sort ? prefs.direction : defaultDirection(sort))}
              className={itemClass}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-octave-accent-text">{prefs.sort === sort && <Check className="h-4 w-4" aria-hidden />}</span>
              {t(`listOrder.sort.${sort}`)}
            </button>
          ))}
          {prefs.sort !== "custom" && (
            <>
              <div role="separator" className="mx-2 my-1.5 h-px bg-line-subtle" />
              {(defaultDirection(prefs.sort) === "asc" ? (["asc", "desc"] as const) : (["desc", "asc"] as const)).map((direction) => (
                <button key={direction} type="button" role="menuitemradio" aria-checked={prefs.direction === direction} onClick={() => pick(prefs.sort, direction)} className={itemClass}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-octave-accent-text">{prefs.direction === direction && <Check className="h-4 w-4" aria-hidden />}</span>
                  {t(`listOrder.direction.${prefs.sort}.${direction}`)}
                </button>
              ))}
            </>
          )}
        </FloatingLayer>
      )}
    </>
  );
}
