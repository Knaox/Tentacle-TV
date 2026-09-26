import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { RAIL_WIDTH } from "../responsive";
import { HEADER_TOTAL } from "./metrics";
import type { MirrorTab } from "./useMirrorTabs";
import { useSlidingIndicator } from "./useSlidingIndicator";

const ITEM_W = 50;
const ITEM_H = 44;

/**
 * Le rail de l'iPad en PAYSAGE (`TabRail` de l'app) : 76 de large, fond
 * transparent, un filet à droite, icônes seules sous la même pilule glissante
 * que la barre basse. Le bouton du haut déroule le tiroir à libellés.
 */
export const TabRail = memo(function TabRail({ tabs, onOpenMenu, onExtensions }: {
  tabs: MirrorTab[];
  onOpenMenu: () => void;
  onExtensions: () => void;
}) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const indicator = useSlidingIndicator(tabs.findIndex((tab) => tab.active), {
    size: { width: ITEM_W, height: ITEM_H },
    align: "center",
    deps: [tabs.length],
  });

  return (
    <nav
      className="fixed bottom-0 left-0 top-0 z-30 flex flex-col items-center border-r border-line-subtle"
      style={{
        width: `calc(${RAIL_WIDTH}px + env(safe-area-inset-left, 0px))`,
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingTop: `calc(${HEADER_TOTAL} + 12px)`,
      }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t("more")}
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-content-tertiary active:bg-fill-subtle"
      >
        <Menu size={20} aria-hidden />
      </button>
      <div ref={indicator.trackRef} role="tablist" className="relative flex flex-col items-center gap-2">
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full border border-line-subtle bg-fill-soft"
          style={indicator.style}
        />
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            data-tab-item
            aria-selected={tab.active}
            aria-label={tab.label}
            onClick={() => (tab.path === null ? onExtensions() : navigate(tab.path))}
            className="relative flex items-center justify-center"
            style={{ width: ITEM_W, height: ITEM_H }}
          >
            <span className="mirror-press flex">
              <tab.Icon size={22} color={tab.active ? "var(--brand)" : "var(--text-tertiary)"} aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
});
