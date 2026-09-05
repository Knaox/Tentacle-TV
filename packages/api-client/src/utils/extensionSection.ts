/**
 * Identité d'une page d'extension sur mobile — « section » de l'onglet unique
 * qui regroupe toutes les pages des plugins : `<pluginId>:<path>`.
 *
 * Un identifiant de plugin ne contient jamais `:` (validé côté serveur :
 * `/^[a-z0-9][a-z0-9._-]{0,63}$/`) ; le chemin, lui, peut en contenir — d'où
 * la coupure sur le PREMIER `:` seulement. Le format est partagé par l'écran
 * des extensions (qui lit `?section=`) et par la résolution des notifications
 * (qui l'écrit) : un seul endroit le définit.
 */
export const EXTENSIONS_TAB_PATH = "/extensions";

export function extensionSectionId(pluginId: string, path: string): string {
  return `${pluginId}:${path}`;
}

export function parseExtensionSectionId(id: string): { pluginId: string; path: string } | null {
  const i = id.indexOf(":");
  if (i <= 0 || i === id.length - 1) return null;
  return { pluginId: id.slice(0, i), path: id.slice(i + 1) };
}

/** Lien profond mobile vers une section : `/extensions?section=seer%3A%2Frequests`. */
export function extensionSectionHref(pluginId: string, path: string): string {
  return `${EXTENSIONS_TAB_PATH}?section=${encodeURIComponent(extensionSectionId(pluginId, path))}`;
}
