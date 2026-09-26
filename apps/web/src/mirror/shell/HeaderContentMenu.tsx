import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, ChevronRight, Heart, Layers, Smartphone, type LucideIcon } from "lucide-react";
import { useDownloadsVisibility } from "../../downloads/useDownloadState";
import { HEADER_TOTAL } from "./metrics";

interface Entry {
  path: string;
  Icon: LucideIcon;
  label: string;
  /** Un filet le sépare de ce qui précède (ce n'est plus une liste). */
  apart?: boolean;
}

/**
 * « Mes contenus » (`HeaderContentMenu` de l'app) : Ma liste, Mes favoris et,
 * s'il y a du contenu local, Sur cet appareil — derrière une seule icône.
 * Le panneau (264 de large, rayon 18, surface pleine) naît du coin haut droit
 * de l'icône : 200 ms à l'ouverture, 140 à la fermeture.
 */
export function HeaderContentMenu() {
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const { hasContent } = useDownloadsVisibility();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const entries: Entry[] = [
    { path: "/watchlist", Icon: Bookmark, label: t("myList") },
    { path: "/favorites", Icon: Heart, label: t("myFavorites") },
    ...(hasContent ? [{ path: "/on-device", Icon: Smartphone, label: t("onDevice"), apart: true }] : []),
  ];

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("myContent")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="mirror-press -m-3 flex p-3 text-content-primary"
      >
        <Layers size={21} strokeWidth={2} aria-hidden />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-50">
              <motion.button
                type="button"
                aria-label={tc("close")}
                className="absolute inset-0 cursor-default"
                style={{ background: "rgba(0,0,0,0.4)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.14 } }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                role="menu"
                className="absolute w-[264px] rounded-[18px] border border-line-subtle bg-surface-2 p-2"
                style={{
                  top: `calc(${HEADER_TOTAL} - 6px)`,
                  right: 12,
                  transformOrigin: "top right",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
                }}
                initial={{ opacity: 0, y: -8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: [0.33, 1, 0.68, 1] } }}
                exit={{ opacity: 0, y: -8, scale: 0.94, transition: { duration: 0.14, ease: [0.32, 0, 0.67, 0] } }}
              >
                <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-[0.4px] text-content-tertiary">
                  {t("myContent")}
                </p>
                {entries.map((entry) => (
                  <div key={entry.path}>
                    {entry.apart && <div className="mx-2.5 my-1.5 h-px bg-line-subtle" />}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => go(entry.path)}
                      className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2.5 text-left active:bg-fill-soft"
                    >
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-fill-subtle text-content-secondary">
                        <entry.Icon size={19} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-content-primary">
                        {entry.label}
                      </span>
                      <ChevronRight size={18} className="text-content-quaternary" aria-hidden />
                    </button>
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
