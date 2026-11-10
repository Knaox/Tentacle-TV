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
import { LeafIcon } from "@phosphor-icons/react/dist/csr/Leaf";
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
        className="lgc-status btn btn-soft btn-sm"
      >
        <LeafIcon size={16} aria-hidden className="lgc-status-dot" />
        <span className="hidden sm:inline">{t("saverChip")}</span>
      </button>

      {/* Le calque commun : posé dans la fenêtre, jamais coupé (`FloatingLayer`). */}
      <FloatingLayer
        open={open}
        anchor={wrapRef}
        onDismiss={() => setOpen(false)}
        role="dialog"
        ariaLabel={t("saverPopoverTitle")}
        // Le menu du socle : opaque, sans flou derrière (docs/REFONTE-UI.md, § 4).
        className="ui-menu lg-menu w-80 overflow-y-auto overscroll-contain !p-0"
      >
        <div className="lg-sep flex flex-col gap-1.5 border-b border-line-subtle px-4 pb-3.5 pt-4">
          <p className="text-[15px] font-semibold text-content-primary">{t("saverPopoverTitle")}</p>
          <p className="text-[13px] leading-relaxed text-content-secondary">
            {setting === "on" ? t("saverForcedReason") : t("saverAutoReason")}
          </p>
          <p className="text-[13px] leading-relaxed text-content-tertiary">
            {t("saverEffects")}
          </p>
          {setting === "auto" && (
            <p className="text-[13px] leading-relaxed text-content-tertiary">
              {t("saverAutoHint")}
            </p>
          )}
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSetting("off");
            }}
            className="btn btn-soft btn-sm w-full"
          >
            {t("saverDisable")}
          </button>
        </div>
      </FloatingLayer>
    </div>
  );
}
