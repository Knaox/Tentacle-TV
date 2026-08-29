/**
 * Pédagogie du plein écran Wayland — UNE fois par appareil, et SEULEMENT là
 * où le plein écran est réellement imposé (compositeur sans colle KWin,
 * `fenetrage === "plein-ecran"`) : quand la lecture suit la fenêtre, il n'y a
 * rien à expliquer. Cf. lib/waylandFullscreenNotice.ts.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { fenetrageLinux, montageLinux } from "../desktop/detect";
import { fullscreenNoticeSeen, markFullscreenNoticeSeen } from "../lib/waylandFullscreenNotice";

export function useWaylandFullscreenNotice(ready: boolean): void {
  const { show: showToast } = useToast();
  const { t: tPreferences } = useTranslation("preferences");
  useEffect(() => {
    // `hasFocus` : une lecture SANS geste (reprise automatique) laisse la page
    // DERRIÈRE la fenêtre mpv — l'avis y serait invisible ET consommé. Il
    // attend donc une lecture au premier plan (mesuré le 28.08 : la première
    // version a brûlé sa cartouche hors de toute vue).
    if (
      !ready ||
      montageLinux() !== "wayland" ||
      fenetrageLinux() !== "plein-ecran" ||
      !document.hasFocus() ||
      fullscreenNoticeSeen()
    ) {
      return;
    }
    markFullscreenNoticeSeen();
    showToast("info", tPreferences("linuxSessionFullscreenToast"));
  }, [ready, showToast, tPreferences]);
}
