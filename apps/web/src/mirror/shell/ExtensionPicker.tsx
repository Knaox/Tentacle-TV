import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { RAIL_WIDTH, SHEET_MAX_WIDTH } from "../responsive";
import { useViewport } from "../useFormFactor";
import { TAB_BAR_TOTAL } from "./metrics";
import type { ExtensionPlugin } from "./useMirrorTabs";

/**
 * Le sous-menu des extensions (`ExtensionPicker` de l'app), ouvert par l'onglet
 * quand PLUSIEURS plugins publient des pages : un plugin par ligne, le courant
 * coché, ses pages en pastilles. Au-dessus de la barre (ou à côté du rail).
 */
export function ExtensionPicker({ open, plugins, activePluginId, sideNav, onSelect, onClose }: {
  open: boolean;
  plugins: ExtensionPlugin[];
  activePluginId: string | undefined;
  sideNav: boolean;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const { width } = useViewport();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const cardW = Math.min(width - 24, SHEET_MAX_WIDTH);
  const placement = sideNav
    ? { left: RAIL_WIDTH + 12, bottom: 20, width: 360 }
    : { left: (width - cardW) / 2, width: cardW, bottom: `calc(${TAB_BAR_TOTAL} + 8px)` };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label={tc("close")}
            className="absolute inset-0 cursor-default"
            style={{ background: "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            onClick={onClose}
          />
          <motion.div
            role="menu"
            className="mirror-glass-strong absolute rounded-2xl border border-line-subtle pb-2 pt-3"
            style={{ ...placement, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.14 } }}
          >
            <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.8px] text-content-tertiary">
              {t("extensions")}
            </p>
            <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto px-2">
              {plugins.map((plugin) => {
                const active = plugin.pluginId === activePluginId;
                const oneNamedPage = plugin.sections.length === 1 && plugin.sections[0].label === plugin.name;
                return (
                  <div key={plugin.pluginId} className="rounded-xl pb-0.5" style={{ background: active ? "var(--brand-soft)" : undefined }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => onSelect(plugin.path)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left active:opacity-70"
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-[10px]"
                        style={{ background: active ? "var(--brand-glow)" : "var(--fill-soft)" }}
                      >
                        <plugin.Icon size={18} color={active ? "var(--brand-light)" : "var(--text-secondary)"} aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={`truncate text-[15px] font-semibold ${active ? "text-brand-light" : "text-content-primary"}`}>
                          {plugin.name}
                        </span>
                        {!oneNamedPage && (
                          <span className="truncate text-xs text-content-tertiary">
                            {plugin.sections.map((s) => s.label).join(" · ")}
                          </span>
                        )}
                      </span>
                      {active && <Check size={18} className="text-brand-light" aria-hidden />}
                    </button>
                    {plugin.sections.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 pb-2 pl-14 pr-2">
                        {plugin.sections.map((section) => (
                          <button
                            key={section.path}
                            type="button"
                            role="menuitem"
                            onClick={() => onSelect(section.path)}
                            className="flex h-[34px] items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-3 text-[12.5px] font-medium text-content-secondary active:opacity-70"
                          >
                            <section.Icon size={13} className="text-content-tertiary" aria-hidden />
                            <span className="truncate">{section.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
