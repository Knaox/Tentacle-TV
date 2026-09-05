import { useEffect } from "react";
import { updateDebugEnabled } from "../lib/updateSimulation";
import { WHATS_NEW_RELEASES, findRelease } from "./releases";
import { selectWhatsNewFeatures, type WhatsNewSelection } from "./selectFeatures";

/**
 * `?whatsnewgate=1` : dans la préviz navigateur, où `isDesktopApp()` est faux,
 * la porte et le bouton « Revoir » se comportent comme sur desktop. Builds de
 * développement seulement — ailleurs la garde tue le code.
 */
export function whatsNewGateForced(): boolean {
  if (!updateDebugEnabled()) return false;
  try {
    return new URLSearchParams(window.location.search).get("whatsnewgate") === "1";
  } catch {
    return false;
  }
}

/** La sélection d'une release précise (À propos, crochet avec version) : rien si elle est vide ou inconnue. */
export function selectionForRelease(version: string): WhatsNewSelection | null {
  const release = findRelease(version);
  if (!release || release.features.length === 0) return null;
  return {
    features: release.features.map((feature) => ({ ...feature, version: release.version })),
    from: null,
    to: release.version,
    spansReleases: false,
  };
}

/**
 * `window.__tentacleShowWhatsNew(version?)` — la touche N du panneau F9, et la
 * console. Sans argument : TOUT le registre, sans plafond, pour revoir chaque
 * scène. La fermeture n'écrit jamais le drapeau. Même garde que la pop-up de
 * démonstration : elle couvre Vite ET la coquille Electron de développement.
 */
export function useWhatsNewDevHook(show: (selection: WhatsNewSelection) => void): void {
  useEffect(() => {
    if (!updateDebugEnabled()) return;
    const w = window as unknown as { __tentacleShowWhatsNew?: (version?: string) => void };
    w.__tentacleShowWhatsNew = (version) => {
      const selection = version
        ? selectionForRelease(version)
        : selectWhatsNewFeatures(null, null, WHATS_NEW_RELEASES, Infinity);
      if (!selection || selection.features.length === 0) {
        console.warn("[whatsNew] rien à montrer pour", version ?? "le registre");
        return;
      }
      show(selection);
    };
    return () => {
      delete w.__tentacleShowWhatsNew;
    };
  }, [show]);
}
