import { isDesktopApp } from "../desktop/detect";
import { resolveDesktopVersion } from "../hooks/useDesktopVersion";
import { readSeenVersion, writeSeenVersion } from "./whatsNewStorage";

/**
 * Première installation desktop — l'app demande l'URL du serveur, c'est le
 * seul moment où l'on en est sûr. On note la version courante : l'écran de
 * nouveautés ne s'imposera qu'à la suivante. Une installation qui a déjà sa
 * version notée (changement de serveur) n'est pas touchée.
 *
 * Sans ce marqueur, la porte lirait « pas de clé » comme une première
 * installation ; or c'est aussi l'état de tous ceux qui arrivent d'une version
 * D'AVANT l'écran (1.20.x → 1.21.0). Grâce à lui, « pas de clé » à la porte
 * veut dire « mis à jour depuis avant » — et l'écran se montre.
 */
export async function recordFreshInstall(): Promise<void> {
  if (!isDesktopApp() || readSeenVersion() !== null) return;
  const version = await resolveDesktopVersion();
  if (version) writeSeenVersion(version);
}
