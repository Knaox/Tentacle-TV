/**
 * Pastille « Hors ligne » du TopNav — desktop (Tauri) uniquement.
 * Invisible en ligne : l'état Standard reste visuellement inchangé.
 * Clic → popover d'état (cause, joignabilité) + actions : réessayer,
 * rester hors ligne (mode manuel), repasser en ligne.
 *
 * Animations en CSS pur (`animate-scale-in`, `animate-pulse-glow`) — pas de
 * Framer Motion dans la feature téléchargements/hors-ligne, par contrainte.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauriApp } from "../main";
import { useConnectivity } from "./useConnectivity";
import { probeNow, setManualOffline } from "./connectivityStore";

export function ConnectivityChip() {
  const { t } = useTranslation("downloads");
  const snap = useConnectivity();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Échap ferme le popover.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Clic hors du popover ferme.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  const offline = snap.state === "offline-auto" || snap.state === "offline-manual";
  useEffect(() => {
    if (!offline) setOpen(false);
  }, [offline]);

  if (!isTauriApp || !offline) return null;
  const manual = snap.state === "offline-manual";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-line-subtle bg-status-warning-bg px-3 text-xs font-semibold text-status-warning-fg transition-opacity duration-150 hover:opacity-80"
      >
        <span className="h-2 w-2 rounded-full bg-status-warning animate-pulse-glow" />
        <span className="hidden sm:inline">{t(manual ? "offlineChipManual" : "offlineChip")}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("offlinePopoverTitle")}
          className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right animate-scale-in overflow-hidden"
          style={{
            background: "var(--surface-dropdown)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-dropdown)",
            backdropFilter: "blur(var(--blur-dropdown))",
            WebkitBackdropFilter: "blur(var(--blur-dropdown))",
          }}
        >
          <div className="border-b border-line-subtle px-4 py-3">
            <p className="text-sm font-semibold text-content-primary">{t("offlinePopoverTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {manual
                ? `${t("offlineManualEnabled")} ${
                    snap.reachable ? t("offlineServerReachable") : t("offlineServerUnreachable")
                  }`
                : snap.reason === "jellyfin"
                  ? t("offlineReasonJellyfin")
                  : t("offlineReasonBackend")}
            </p>
            {!manual && (
              <p className="mt-1 text-xs leading-relaxed text-content-quaternary">
                {t("offlineAutoHint")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 px-4 py-3">
            {manual ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setManualOffline(false);
                }}
                className="inline-flex items-center justify-center rounded-md bg-cta-primary-bg px-3 py-2 text-xs font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
              >
                {t("offlineGoOnline")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => probeNow(true)}
                  className="inline-flex items-center justify-center rounded-md border border-line-strong bg-fill-subtle px-3 py-2 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft"
                >
                  {t("offlineRetry")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setManualOffline(true);
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-cta-ghost-bg px-3 py-2 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-cta-ghost-bg-hover"
                >
                  {t("offlineStayOffline")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
