/**
 * Pastille « Hors ligne » du TopNav — desktop (Tauri) uniquement.
 * Invisible en ligne : l'état Standard reste visuellement inchangé.
 * Clic → popover d'état (cause, joignabilité) + actions : réessayer,
 * rester hors ligne (mode manuel), repasser en ligne.
 *
 * La pilule et le menu du socle (refonte de nov. 2026) : opaques, sans flou,
 * et plus rien qui bat dans la barre — l'icône suffit à dire l'état.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { FloatingLayer } from "../components/floating/FloatingLayer";
import { connectivityCaseOf, connectivityCopy } from "@tentacle-tv/shared";
import { isDesktopApp } from "../desktop/bridge";
import { useConnectivity } from "./useConnectivity";
import { probeNow, setManualOffline } from "./connectivityStore";
import { useActiveProfile } from "../auth/profileSession";

export function ConnectivityChip() {
  const { t } = useTranslation("downloads");
  const snap = useConnectivity();
  // La cause en mots, la même que le message de bascule (les trois cas partagés).
  const offlineCause = connectivityCopy(connectivityCaseOf(snap.reason) ?? "server");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const profileSession = useActiveProfile() !== null;

  const offline = snap.state === "offline-auto" || snap.state === "offline-manual";
  useEffect(() => {
    if (!offline) setOpen(false);
  }, [offline]);

  if (!isDesktopApp() || !offline) return null;
  const manual = snap.state === "offline-manual";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // La pilule du socle, à la teinte de l'avertissement ; le point ne bat plus (la barre
        // est affichée sur toutes les pages : rien d'animé n'y dure).
        className="lgc-status btn btn-sm bg-status-warning-bg text-status-warning-fg"
      >
        <WifiSlashIcon size={16} weight="fill" aria-hidden className="lgc-status-dot" />
        <span className="hidden sm:inline">{t(manual ? "offlineChipManual" : "offlineChip")}</span>
      </button>

      {/* Le calque commun : posé dans la fenêtre, jamais coupé (`FloatingLayer`). */}
      <FloatingLayer
        open={open}
        anchor={wrapRef}
        onDismiss={() => setOpen(false)}
        role="dialog"
        ariaLabel={t("offlinePopoverTitle")}
        // Le menu du socle : opaque, sans flou derrière (docs/REFONTE-UI.md, § 4).
        className="ui-menu lg-menu w-80 overflow-y-auto overscroll-contain !p-0"
      >
        <div className="lg-sep flex flex-col gap-1.5 border-b border-line-subtle px-4 pb-3.5 pt-4">
          <p className="text-[15px] font-semibold text-content-primary">{t("offlinePopoverTitle")}</p>
          <p className="text-[13px] leading-relaxed text-content-secondary">
            {manual
              ? `${t("offlineManualEnabled")} ${
                  snap.reachable ? t("offlineServerReachable") : t("offlineServerUnreachable")
                }`
              : `${t(offlineCause.titleKey)}. ${t(offlineCause.hintKey)}`}
          </p>
          {!manual && (
            <p className="text-[13px] leading-relaxed text-content-tertiary">
              {t("offlineAutoHint")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 p-3">
          {manual ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setManualOffline(false);
              }}
              className="btn btn-solid btn-sm"
            >
              {t("offlineGoOnline")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => probeNow(true)}
                className="btn btn-soft btn-sm"
              >
                {t("offlineRetry")}
              </button>
              {/* La session d'un PROFIL n'a pas de hors ligne à elle (rien n'est
                  gardé pour lui) : y rester ne mènerait à rien. */}
              {!profileSession && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setManualOffline(true);
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  {t("offlineStayOffline")}
                </button>
              )}
            </>
          )}
        </div>
      </FloatingLayer>
    </div>
  );
}
