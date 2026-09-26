import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, type LucideIcon } from "lucide-react";
import { HEADER_TOTAL } from "./metrics";
import type { ExtensionPlugin, MirrorTab } from "./useMirrorTabs";
import { useSlidingIndicator } from "./useSlidingIndicator";

const PANEL_W = 248;
const PANEL_PAD_H = 12;
const ROW_H = 46;

interface Item {
  key: string;
  label: string;
  Icon: LucideIcon;
  path: string;
  active: boolean;
}

/**
 * Le tiroir du rail iPad (`RailMenu` de l'app) : panneau de verre de 248 qui
 * glisse depuis la gauche (220 ms à l'ouverture, 160 à la fermeture), voile
 * qui ferme au toucher. Plusieurs plugins y ont chacun leur ligne. Il se
 * démonte une fois fermé : son flou ne reste pas masqué derrière une opacité.
 */
export function RailMenu({ open, onClose, tabs, plugins, activePlugin }: {
  open: boolean;
  onClose: () => void;
  tabs: MirrorTab[];
  plugins: ExtensionPlugin[];
  activePlugin: ExtensionPlugin | undefined;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const tab of tabs) {
      if (tab.key === "extensions" && plugins.length > 1) {
        for (const p of plugins) {
          out.push({ key: `ext:${p.pluginId}`, label: p.name, Icon: p.Icon, path: p.path, active: activePlugin?.pluginId === p.pluginId });
        }
      } else if (tab.path !== null) {
        out.push({ key: tab.key, label: tab.label, Icon: tab.Icon, path: tab.path, active: tab.active });
      }
    }
    return out;
  }, [tabs, plugins, activePlugin]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label={t("close")}
            className="absolute inset-0 cursor-default"
            style={{ background: "rgba(0,0,0,0.4)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            onClick={onClose}
          />
          <motion.div
            className="mirror-glass-strong absolute bottom-0 left-0 top-0 overflow-hidden border-r border-line-subtle"
            style={{ width: PANEL_W, paddingLeft: "env(safe-area-inset-left, 0px)" }}
            initial={{ x: -(PANEL_W + 24) }}
            animate={{ x: 0, transition: { duration: 0.22, ease: [0.33, 1, 0.68, 1] } }}
            exit={{ x: -(PANEL_W + 24), transition: { duration: 0.16, ease: [0.32, 0, 0.67, 0] } }}
          >
            <div style={{ paddingTop: `calc(${HEADER_TOTAL} + 12px)`, paddingLeft: PANEL_PAD_H, paddingRight: PANEL_PAD_H }}>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="mb-4 ml-1 flex h-11 w-11 items-center justify-center rounded-xl text-content-secondary active:bg-fill-subtle"
              >
                <Menu size={20} aria-hidden />
              </button>
              <MenuList items={items} onPick={(path) => { navigate(path); onClose(); }} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function MenuList({ items, onPick }: { items: Item[]; onPick: (path: string) => void }) {
  const indicator = useSlidingIndicator(items.findIndex((i) => i.active), {
    size: { width: PANEL_W - 2 * PANEL_PAD_H, height: ROW_H },
    align: "center",
    deps: [items.length],
  });
  return (
    <div ref={indicator.trackRef} role="tablist" className="relative flex flex-col gap-1">
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full border border-line-subtle bg-fill-soft"
        style={indicator.style}
      />
      {items.map((item) => {
        const color = item.active ? "var(--brand)" : "var(--text-tertiary)";
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            data-tab-item
            aria-selected={item.active}
            onClick={() => onPick(item.path)}
            className="relative flex items-center gap-3 px-3.5 text-left"
            style={{ height: ROW_H }}
          >
            <item.Icon size={20} color={color} aria-hidden />
            <span
              className="flex-1 truncate text-[13.5px] font-semibold"
              style={{ color: item.active ? "var(--brand)" : "var(--text-secondary)" }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
