/**
 * Les liens `tentacle://octave/<page>` remis par le SYSTÈME (une playlist partagée, la page d'ouverture d'un
 * serveur, « Ouvrir dans l'app Tentacle ») : le bureau déclare le schéma (Info.plist, MSIX, `.desktop`) et ouvre
 * la page d'Octave qu'il désigne.
 *
 * Trois arrivées : macOS `open-url` (à écouter AVANT `whenReady`, sinon le lien du lancement est perdu) ; Windows
 * et Linux la ligne de commande, au lancement (`process.argv`) ou par la seconde instance (`second-instance`).
 * Le processus principal ne fait que TRANSMETTRE le lien brut, borné, à la page : la liste des pages qu'un lien
 * peut ouvrir vit dans la règle partagée (`octaveOpenTarget`, `@tentacle-tv/shared/octave/mode`), appliquée par
 * la page — jamais une route arbitraire. Le lien du lancement attend que la page le demande (`app_link_take`) :
 * elle n'écoute pas encore quand il arrive.
 */

import { app } from "electron";
import { z } from "zod";
import type { CommandRegistry } from "./ipc/registry";
import { getMainWindow } from "./window";

/** Le seul hôte du schéma qui vienne du système (`tentacle://app` est l'origine de la page : jamais). */
const PREFIX = "tentacle://octave/";
const MAX_LENGTH = 8192;
export const APP_LINK_EVENT = "app-link";

let pending: string | null = null;

/** Le lien d'app d'une valeur reçue du système ; `null` pour tout autre. */
export function appLinkOf(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_LENGTH) return null;
  return raw.toLowerCase().startsWith(PREFIX) ? raw : null;
}

/** Le lien d'une ligne de commande (Windows, Linux : le système le passe en argument). */
export function appLinkFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv) {
    const link = appLinkOf(arg);
    if (link) return link;
  }
  return null;
}

/** Remet un lien à la page : tout de suite si elle écoute, sinon au moment où elle le demandera. */
export function deliverAppLink(raw: unknown): boolean {
  const link = appLinkOf(raw);
  if (!link) return false;
  pending = link;
  const win = getMainWindow();
  if (win && !win.webContents.isLoading()) {
    win.webContents.send(`tentacle:${APP_LINK_EVENT}`, link);
    pending = null;
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  return true;
}

/** À appeler AVANT `whenReady` : `open-url` de macOS, et le lien du lancement (Windows, Linux). */
export function listenForAppLinks(reopen: () => void): void {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    // Sans fenêtre (file finie en arrière-plan), la page rouverte le prendra.
    if (deliverAppLink(url)) reopen();
  });
  const atLaunch = appLinkFromArgv(process.argv);
  if (atLaunch) pending = atLaunch;
}

export function registerAppLinkCommands(registry: CommandRegistry): void {
  registry.add("app_link_take", {
    schema: z.object({}).passthrough(),
    run: () => {
      const link = pending;
      pending = null;
      return link;
    },
  });
}
