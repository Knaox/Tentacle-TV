/**
 * Partager une liste : son lien public, et la feuille de partage du système
 * quand il y en a une.
 */

import { isDesktopApp } from "../desktop/detect";
import { getBackendBase } from "./backendBase";

/**
 * Le lien public d'une liste partagée (`/share/:token`).
 *
 * Sur le bureau, `window.location.origin` vaut `tentacle://app` : un lien que
 * personne d'autre ne sait ouvrir. On vise l'origine publique du serveur ; sur
 * le web, `getBackendBase()` est vide et l'origine de la page est la bonne.
 */
export function shareListUrl(token: string): string {
  const origin = getBackendBase().replace(/\/$/, "") || window.location.origin;
  return `${origin}/share/${token}`;
}

/**
 * La feuille de partage du système : mobiles, Safari, Chrome et Edge sur
 * macOS et Windows. Absente de Firefox et de Linux — et d'Electron, où
 * `navigator.share` n'existe pas (mesuré sous Electron 43). Le bureau s'en
 * passe exprès : s'il apparaissait avec une mise à jour, il n'y aurait été
 * éprouvé nulle part, et « Copier » y fait déjà le travail.
 */
export function canShareNatively(): boolean {
  return !isDesktopApp() && typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * `shared` : la feuille a servi. `dismissed` : l'utilisateur l'a refermée,
 * rien à signaler. `failed` : refusée — le plus souvent parce que le geste a
 * expiré pendant un appel réseau (Safari) ; l'appelant se rabat sur la copie.
 */
export type ShareOutcome = "shared" | "dismissed" | "failed";

/** Ouvre la feuille de partage du système. */
export async function shareNatively(data: ShareData): Promise<ShareOutcome> {
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    return (error as { name?: unknown } | null)?.name === "AbortError" ? "dismissed" : "failed";
  }
}
