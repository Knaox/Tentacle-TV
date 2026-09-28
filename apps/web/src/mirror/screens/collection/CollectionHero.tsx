import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { firstBackdropItem, resolveBackdropId } from "../../../components/hero/resolveBackdrop";
import { useThemeMode } from "../../../theme/useThemeMode";
import { LIBRARY_HERO_HEIGHT } from "../libraries/LibraryHero";

/** La zone sûre d'un écran empilé (`MirrorLayout`) : l'ambiance remonte d'autant. */
export const STACKED_TOP = "max(env(safe-area-inset-top, 0px), 24px)";

/** Le voile de `LibraryHero`, à l'identique : l'image se fond dans la page. */
const VEIL =
  "linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 55%, transparent) 0%, " +
  "color-mix(in srgb, var(--surface-0) 15%, transparent) 35%, " +
  "color-mix(in srgb, var(--surface-0) 70%, transparent) 72%, var(--surface-0) 100%)";

/**
 * L'en-tête de Ma liste et de Mes favoris (`collection/CollectionHero` de
 * l'app) : l'AMBIANCE de la Bibliothèque — une image pleine largeur qui
 * remonte sous la zone sûre et se fond dans la page, surtitre 11 gras
 * capitales `brand.light` avec son icône 12, titre 40/46 extra-gras, résumé
 * 14 semi-gras — et le retour flottant de son écran empilé (rond de 40, aplat
 * translucide sans flou, à portée pendant tout le défilement).
 *
 * L'image est celle du premier titre de la collection, déjà en mémoire : zéro
 * requête, et immobile (une liste qu'on a constituée n'a pas de vitrine à
 * faire tourner). Sous le résumé, les gestes de la page (`actions`).
 */
export const CollectionHero = memo(function CollectionHero({
  items, title, kicker, Icon, subtitle, onBack, actions,
}: {
  items: MediaItem[] | undefined;
  title: string;
  kicker: string;
  Icon: LucideIcon;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { isDark } = useThemeMode();
  const featured = firstBackdropItem(items);
  const backdropId = featured ? resolveBackdropId(featured) : null;
  const url = backdropId ? client.getImageUrl(backdropId, "Backdrop", { width: 1280, quality: 75, index: 0 }) : null;

  return (
    <>
      <div className="relative flex flex-col justify-end pb-4" style={{ minHeight: LIBRARY_HERO_HEIGHT }}>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ top: `calc(-1 * ${STACKED_TOP})` }}
          aria-hidden
        >
          {url && <img src={url} alt="" draggable={false} decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0" style={{ background: VEIL }} />
        </div>
        <div className="relative flex flex-col gap-0.5 px-4">
          <div className="flex items-center gap-1.5">
            <Icon size={12} className="text-brand-light" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[1.2px] text-brand-light">{kicker}</span>
          </div>
          <h1
            className="truncate text-[40px] font-extrabold leading-[46px] tracking-[-1px] text-content-primary"
            style={{ textShadow: isDark ? "0 2px 12px rgba(0, 0, 0, 0.35)" : "none" }}
          >
            {title}
          </h1>
          {subtitle ? <p className="text-sm font-semibold tabular-nums text-content-secondary">{subtitle}</p> : null}
          {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onBack}
        aria-label={t("back")}
        className="fixed left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-content-primary transition-transform duration-100 active:scale-95 active:opacity-80"
        style={{ top: `calc(${STACKED_TOP} + 4px)`, background: "color-mix(in srgb, var(--surface-0) 72%, transparent)" }}
      >
        <ChevronLeft size={24} aria-hidden />
      </button>
    </>
  );
});
