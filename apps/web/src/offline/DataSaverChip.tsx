/**
 * Pastille « Économie » du TopNav — visible seulement quand le mode économie
 * est actif ET qu'on est en ligne (hors ligne, `ConnectivityChip` prime : deux
 * pastilles côte à côte diraient la même chose deux fois).
 *
 * Elle existe parce que le mode économie CHANGE des choses visibles — images
 * plus douces, hero figé, rangées qui arrivent au défilement. Sans explication,
 * ça se lit comme un bug ; avec, comme une adaptation.
 *
 * Mêmes conventions que `ConnectivityChip` : popover au clic, Échap et clic
 * extérieur pour fermer, animations en CSS pur (pas de Framer Motion dans la
 * feature hors-ligne).
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FloatingLayer } from "../components/floating/FloatingLayer";
import { useConnectivity } from "./useConnectivity";
import { useDataSaverActive, useDataSaverSetting } from "./useDataSaver";

export function DataSaverChip() {
  const { t } = useTranslation("downloads");
  const { state } = useConnectivity();
  const active = useDataSaverActive();
  const { setting, setSetting } = useDataSaverSetting();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const offline = state === "offline-auto" || state === "offline-manual";
  useEffect(() => {
    if (!active || offline) setOpen(false);
  }, [active, offline]);

  if (!active || offline) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="lgc-status flex h-9 items-center gap-2 rounded-full border border-line-subtle bg-fill-subtle px-3 text-xs font-semibold text-content-secondary transition-opacity duration-150 hover:opacity-80"
      >
        <span className="lgc-status-dot h-2 w-2 rounded-full bg-content-tertiary" />
        <span className="hidden sm:inline">{t("saverChip")}</span>
      </button>

      {/* Le calque commun : posé dans la fenêtre, jamais coupé (`FloatingLayer`). */}
      <FloatingLayer
        open={open}
        anchor={wrapRef}
        onDismiss={() => setOpen(false)}
        role="dialog"
        ariaLabel={t("saverPopoverTitle")}
        className="lg-menu w-72 overflow-y-auto overscroll-contain"
        style={{
          background: "var(--surface-dropdown)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-dropdown)",
          backdropFilter: "blur(var(--blur-dropdown))",
          WebkitBackdropFilter: "blur(var(--blur-dropdown))",
        }}
      >
        <div className="lg-sep border-b border-line-subtle px-4 py-3">
          <p className="text-sm font-semibold text-content-primary">{t("saverPopoverTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
            {setting === "on" ? t("saverForcedReason") : t("saverAutoReason")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-content-quaternary">
            {t("saverEffects")}
          </p>
          {setting === "auto" && (
            <p className="mt-1 text-xs leading-relaxed text-content-quaternary">
              {t("saverAutoHint")}
            </p>
          )}
        </div>
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSetting("off");
            }}
            className="inline-flex w-full items-center justify-center rounded-md bg-cta-ghost-bg px-3 py-2 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-cta-ghost-bg-hover"
          >
            {t("saverDisable")}
          </button>
        </div>
      </FloatingLayer>
    </div>
  );
}
