import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, SlidersHorizontal } from "lucide-react";
import { useRecoRow } from "@tentacle-tv/api-client";
import { PLATFORMS } from "../../hooks/usePlatformFilter";

const TMDB_LOGO = "https://image.tmdb.org/t/p/w92";

interface RecoFiltersMenuProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Filtres de la page Recommandations : un bouton « Filtres » (avec compteur)
 * qui ouvre un panneau — plateformes avec LOGO, multi-sélection, remise à
 * zéro. Les logos sont récoltés sur les items déjà servis (TMDB n'en fournit
 * pas hors d'un titre) ; sans logo connu, une pastille à initiale. Panneau
 * MONTÉ à l'ouverture seulement, fond opaque — aucun backdrop-filter.
 */
export function RecoFiltersMenu({ selected, onChange }: RecoFiltersMenuProps) {
  const { t } = useTranslation("reco");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: forYou } = useRecoRow("forYou");
  const { data: inLibrary } = useRecoRow("inLibrary");
  const logoById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of [...(forYou?.items ?? []), ...(inLibrary?.items ?? [])]) {
      for (const p of item.providers ?? []) {
        if (p.logoPath && !map.has(p.id)) map.set(p.id, p.logoPath);
      }
    }
    return map;
  }, [forYou, inLibrary]);

  // Fermeture au clic hors du panneau et à Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div ref={rootRef} className="row-gutter relative z-30 mb-6 flex justify-end">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          selected.length > 0
            ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] text-[var(--brand)]"
            : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
        }`}
      >
        <SlidersHorizontal size={15} aria-hidden />
        {t("filtersButton")}
        {selected.length > 0 && (
          <span className="rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold leading-4 text-cta-brand-fg">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="group"
          aria-label={t("providersFilterAria")}
          className="absolute right-[var(--row-gutter-mobile)] top-[calc(100%+8px)] w-[min(92vw,430px)] rounded-2xl border border-line-subtle bg-surface-modal p-4 shadow-2xl md:right-[var(--row-gutter-desktop)]"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-quaternary">
            {t("filtersPlatformsLabel")}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLATFORMS.map((p) => {
              const active = selected.includes(p.id);
              const logo = logoById.get(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)]"
                      : "border-transparent hover:bg-fill-soft"
                  }`}
                >
                  {logo ? (
                    <img
                      src={`${TMDB_LOGO}${logo}`}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="h-7 w-7 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fill-soft text-xs font-bold text-content-tertiary"
                    >
                      {p.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{p.name}</span>
                  {active && <Check size={14} className="shrink-0 text-[var(--brand)]" aria-hidden />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="mt-3 text-xs font-medium text-content-tertiary transition-colors hover:text-content-primary disabled:opacity-50"
          >
            {t("providersAll")}
          </button>
        </div>
      )}
    </div>
  );
}
