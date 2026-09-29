import { useEffect } from "react";
import { desktopPlatform } from "./bridge";
import { warmUpPlayer } from "./playerWarmup";

/**
 * Après la connexion, l'instance mpv préchauffée — voir `playerWarmup.ts`.
 *
 * Deux secondes, puis un temps mort : le lancement a déjà ses images, ses
 * rangées et ses requêtes, et la sortie vidéo de mpv (un périphérique Vulkan)
 * n'a aucune raison de leur disputer la machine. Une lecture lancée avant
 * part simplement comme avant.
 */
const DELAY_MS = 2000;

export function PlayerWarmupBinding(): null {
  useEffect(() => {
    // Rien à planifier ailleurs — et Safari (client web) n'a pas
    // `requestIdleCallback`.
    if (desktopPlatform() !== "linux") return;
    let idle: number | null = null;
    const timer = window.setTimeout(() => {
      idle = window.requestIdleCallback(() => warmUpPlayer(), { timeout: 3000 });
    }, DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (idle !== null) window.cancelIdleCallback(idle);
    };
  }, []);
  return null;
}
