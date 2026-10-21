/**
 * Le verre de la FENÊTRE : bandeau des feux, barre de navigation, barres
 * latérales des réglages et de l'administration, menus de la barre.
 *
 * Une seule porte, lue par tout ce qui habille la fenêtre : la coquille de
 * bureau macOS qui dessine son propre bandeau (`hostChrome.ts`), le verre natif
 * de macOS 26 que le processus principal a déclaré disponible, et le réglage
 * « Liquid Glass » de l'appareil (Réglages › Apparence).
 *
 * Partout ailleurs — web, Windows, Linux, macOS < 26, réglage coupé,
 * `TENTACLE_LIQUID_GLASS=off` — la porte reste fermée et AUCUNE règle de
 * `windowGlass.css` ne s'applique : elles sont toutes gardées par l'attribut
 * racine `data-lg-chrome`, que seul `HostTitleBar` pose. Le rendu d'avant est
 * donc tenu par construction, au pixel près.
 *
 * ⚠️ Le champ du pont lu ici (`liquidGlass.supported`) est posé par le preload
 * (session lg-natif). Il n'existe pas dans un bureau d'avant : la porte y reste
 * fermée, sans erreur.
 */

import { useSyncExternalStore } from "react";

import { getLiquidGlass, subscribeLiquidGlass } from "../theme/liquidGlass";
import { desktopPlatform, isElectronShell } from "./detect";
import { hostTitleBar } from "./hostChrome";
import "./windowGlass.css";
import "./windowGlassNav.css";

/**
 * Forçage de développement : `localStorage.tentacle_dev_window_glass = "on"`
 * ouvre la porte sans le verre natif (banc, macOS < 26). Jamais lu en
 * production — le bundle n'en garde pas trace.
 */
const DEV_FORCE_KEY = "tentacle_dev_window_glass";

function devForced(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(DEV_FORCE_KEY) === "on";
  } catch {
    return false;
  }
}

function nativeGlassDeclared(): boolean {
  // Lu sans élargir `ElectronBridge` : le champ appartient au pont de lg-natif.
  const bridge = window.tentacle as unknown as { liquidGlass?: { supported?: unknown } } | undefined;
  return bridge?.liquidGlass?.supported === true;
}

/**
 * Figé au chargement : ni la coquille, ni le système, ni le module natif ne
 * changent en cours de session.
 */
const SUPPORTED =
  isElectronShell() && desktopPlatform() === "macos" && hostTitleBar() && (nativeGlassDeclared() || devForced());

/** La fenêtre PEUT-elle porter le verre ? Indépendant du réglage. */
export function windowGlassSupported(): boolean {
  return SUPPORTED;
}

/** Le verre de fenêtre est-il rendu maintenant ? */
export function windowGlassActive(): boolean {
  return SUPPORTED && getLiquidGlass();
}

/** Version React : suit le réglage en direct, sans rechargement. */
export function useWindowGlass(): boolean {
  return useSyncExternalStore(subscribeLiquidGlass, windowGlassActive, windowGlassActive);
}
