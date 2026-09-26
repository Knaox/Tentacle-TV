import { memo } from "react";
import { useNavigate } from "react-router-dom";
import type { MirrorTab } from "./useMirrorTabs";
import { useSlidingIndicator } from "./useSlidingIndicator";
import {
  TAB_LABEL_GAP as LABEL_GAP,
  TAB_LABEL_LINE_HEIGHT as LABEL_LINE_HEIGHT,
  TAB_MIN_BOTTOM_INSET as MIN_BOTTOM_INSET,
  TAB_PILL_H as PILL_H,
  TAB_PILL_W as PILL_W,
  TAB_ROW_PAD_V as ROW_PAD_V,
} from "./metrics";

/** Le libellé replié laisse l'icône descendre au centre de la barre réduite. */
const ICON_SHIFT = (LABEL_GAP + LABEL_LINE_HEIGHT) / 2;

interface Props {
  tabs: MirrorTab[];
  collapsed: boolean;
  /** Onglet des extensions à plusieurs plugins : ouvre le sous-menu. */
  onExtensions: () => void;
}

/**
 * La barre basse de l'app : une pilule de verre qui FLOTTE au-dessus du
 * contenu (marges de 12, rayon 30), l'onglet actif marqué par une pilule
 * neutre qui glisse. Au défilement, elle se compacte (échelle 0,88, dix pixels
 * plus bas) et les libellés s'effacent.
 */
export const GlassTabBar = memo(function GlassTabBar({ tabs, collapsed, onExtensions }: Props) {
  const navigate = useNavigate();
  const activeIndex = tabs.findIndex((t) => t.active);
  const indicator = useSlidingIndicator(activeIndex, {
    size: { width: PILL_W, height: PILL_H },
    align: "top",
    shiftY: collapsed ? ICON_SHIFT : 0,
    deps: [tabs.length],
  });

  return (
    <nav
      className="mirror-chrome-motion fixed inset-x-3 bottom-0 z-40"
      style={{
        paddingBottom: `max(env(safe-area-inset-bottom, 0px), ${MIN_BOTTOM_INSET}px)`,
        transform: collapsed ? "translateY(10px) scale(0.88)" : "none",
        transformOrigin: "50% 100%",
      }}
    >
      <div
        className="mirror-glass-sheet rounded-[30px] border border-line-subtle"
        style={{ boxShadow: "0 10px 24px rgba(0,0,0,0.5)", padding: `${ROW_PAD_V}px 6px` }}
      >
        <div ref={indicator.trackRef} role="tablist" className="relative flex items-center">
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-full border border-line-subtle bg-fill-soft"
            style={indicator.style}
          />
          {tabs.map((tab) => {
            const color = tab.active ? "var(--brand)" : "var(--text-tertiary)";
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                data-tab-item
                aria-selected={tab.active}
                aria-label={tab.label}
                onClick={() => (tab.path === null ? onExtensions() : navigate(tab.path))}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center"
                style={{ gap: LABEL_GAP, WebkitTapHighlightColor: "transparent" }}
              >
                <span
                  className="mirror-chrome-motion flex items-center justify-center"
                  style={{
                    width: PILL_W,
                    height: PILL_H,
                    transform: collapsed ? `translateY(${ICON_SHIFT}px)` : "none",
                  }}
                >
                  <span className="mirror-press flex">
                    <tab.Icon size={22} color={color} strokeWidth={2} aria-hidden />
                  </span>
                </span>
                <span
                  className="mirror-chrome-motion block w-full truncate px-0.5 text-center text-[10px] font-semibold"
                  style={{
                    lineHeight: `${LABEL_LINE_HEIGHT}px`,
                    color,
                    opacity: collapsed ? 0 : 1,
                    transform: collapsed ? `translateY(${-ICON_SHIFT}px) scale(0.7)` : "none",
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
