import { memo } from "react";
import { BackButton } from "./BackButton";
import { HEADER_BAR_HEIGHT } from "./detailMetrics";

/** `max(insets.top, 24)` de l'app. */
export const TOP_INSET = "max(env(safe-area-inset-top), 24px)";

/**
 * `DetailTopBar` de l'app : protège la barre d'état, porte le retour (36) et
 * prend le titre (18 semi-gras) quand celui de la page est parti. Hauteur
 * `max(inset, 24) + 44`, marges 16, écart 8.
 *
 * Deux fonds se relaient, jamais ensemble : un voile noir (0,75, rampe
 * « soft ») tant qu'on est sur l'image, puis la surface PLEINE `surface.s0` et
 * son filet violet à 0,12 une fois le visuel passé. Pas de verre : une barre
 * qui se pose sur du texte doit le cacher. Les fondus lisent `--bar` et
 * `--title` (`useDetailScroll`).
 */
export const DetailTopBar = memo(function DetailTopBar({ title }: { title: string }) {
  const height = `calc(${TOP_INSET} + ${HEADER_BAR_HEIGHT}px)`;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20" style={{ height }}>
      <div
        className="mirror-detail-bar-veil absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.64) 0%, rgba(0,0,0,0.3) 35%, rgba(0,0,0,0.08) 75%, rgba(0,0,0,0) 100%)",
        }}
      />
      <div className="mirror-detail-bar-solid absolute inset-0 bg-surface-0">
        <div className="absolute inset-x-0 bottom-0" style={{ height: 0.5, background: "rgba(var(--brand-rgb), 0.12)" }} />
      </div>
      <div className="relative flex h-full items-center gap-2 px-4" style={{ paddingTop: TOP_INSET }}>
        <div className="pointer-events-auto">
          <BackButton />
        </div>
        <div className="mirror-detail-bar-title min-w-0 flex-1">
          <h2 className="truncate text-[18px] font-semibold tracking-[-0.4px] text-content-primary">{title}</h2>
        </div>
      </div>
    </div>
  );
});
