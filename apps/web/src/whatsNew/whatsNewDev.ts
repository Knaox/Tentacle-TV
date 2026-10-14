import { useEffect } from "react";
import type { ServerCapability } from "@tentacle-tv/shared";
import { isWebDebugEnabled } from "../lib/webDebug";
import { WHATS_NEW_RELEASES, findRelease } from "./releases";
import { forAudience, forServer, selectWhatsNewFeatures, type WhatsNewSelection } from "./selectFeatures";
import { getUserInfo } from "../components/userMenu/menuItems";

/**
 * `?whatsnewgate=1` : dans la préviz navigateur, où `isDesktopApp()` est faux,
 * la porte et le bouton « Revoir » se comportent comme sur desktop. Derrière la
 * porte du débogage du web seulement (`lib/webDebug.ts` : développement, build
 * instrumenté, ou `TENTACLE_WEB_DEBUG` posé sur le serveur) — jamais sinon.
 */
export function whatsNewGateForced(): boolean {
  if (!isWebDebugEnabled()) return false;
  try {
    return new URLSearchParams(window.location.search).get("whatsnewgate") === "1";
  } catch {
    return false;
  }
}

/**
 * La sélection d'une release précise (À propos, crochet avec version) : rien si
 * elle est vide ou inconnue. `capabilities` : celles du serveur — « À propos »
 * les passe, et ce que le serveur ne sait pas faire n'est pas rejoué ; le
 * crochet de développement s'en passe, pour revoir chaque scène.
 */
export function selectionForRelease(version: string, capabilities?: ReadonlySet<ServerCapability>): WhatsNewSelection | null {
  const found = findRelease(version);
  // « À propos » rejoue pour CE compte : sans les nouveautés d'administrateur, s'il ne l'est pas.
  const forAccount = found ? forAudience([found], getUserInfo().isAdmin) : [];
  const release = (capabilities ? forServer(forAccount, capabilities) : forAccount)[0];
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
 * scène. La fermeture n'écrit jamais le drapeau. Derrière la porte du débogage
 * du web : Vite, la coquille Electron de développement, et un serveur dont
 * l'administrateur a posé `TENTACLE_WEB_DEBUG`.
 */
export function useWhatsNewDevHook(show: (selection: WhatsNewSelection) => void): void {
  useEffect(() => {
    if (!isWebDebugEnabled()) return;
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
