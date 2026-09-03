import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, SlidersHorizontal } from "lucide-react";
import { useWatchProviders } from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES } from "@tentacle-tv/shared";
import { useRecoFilter } from "../../hooks/useRecoFilter";
import { PlatformLogo } from "./PlatformLogo";
import { activeFamilyCount, buildPlatformCatalog, isFamilyActive, toggleFamily } from "./platformCatalog";

/**
 * Filtres de la page Recommandations : un bouton « Filtres » (avec compteur)
 * qui ouvre un panneau — les FAMILLES de plateformes présentes dans la
 * région (Crunchyroll et son canal Amazon ne font qu'un), avec leur logo,
 * multi-sélection, remise à zéro. La sélection vit dans le store du filtre
 * (miroir local + réglage du compte) : c'est le SERVEUR qui filtre, strictement.
 * Panneau MONTÉ à l'ouverture seulement, fond opaque — aucun backdrop-filter.
 */
export function RecoFiltersMenu() {
  const { t } = useTranslation("reco");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { selected, setSelected, clear } = useRecoFilter();
  const { data: directory } = useWatchProviders();
  const catalog = useMemo(() => buildPlatformCatalog(PLATFORM_FAMILIES, directory), [directory]);
  const activeCount = activeFamilyCount(catalog, selected);

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

  return (
    <div ref={rootRef} className="row-gutter relative z-30 mb-6 flex justify-end">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          activeCount > 0
            ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] text-[var(--brand)]"
            : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
        }`}
      >
        <SlidersHorizontal size={15} aria-hidden />
        {t("filtersButton")}
        {activeCount > 0 && (
          <span className="rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold leading-4 text-cta-brand-fg">
            {activeCount}
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
            {catalog.map((entry) => {
              const active = isFamilyActive(entry, selected);
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(toggleFamily(selected, entry))}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)]"
                      : "border-transparent hover:bg-fill-soft"
                  }`}
                >
                  <PlatformLogo logoPath={entry.logoPath} label={entry.label} />
                  <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{entry.label}</span>
                  {active && <Check size={14} className="shrink-0 text-[var(--brand)]" aria-hidden />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={activeCount === 0}
            className="mt-3 text-xs font-medium text-content-tertiary transition-colors hover:text-content-primary disabled:opacity-50"
          >
            {t("providersAll")}
          </button>
        </div>
      )}
    </div>
  );
}
