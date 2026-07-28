/**
 * Commandes de mise à jour applicative (Microsoft Store).
 *
 * Enregistrer `check_msix_update` fait passer `supportsAppUpdates()` à vrai
 * côté page : la bannière et le bouton « Mettre à jour » réapparaissent.
 * Aucune modification d'`apps/web` — `useAutoUpdate` et `updateCheckers` sont
 * déjà écrits pour ce contrat.
 *
 * **Windows uniquement, et c'est voulu.** Sur macOS les mises à jour
 * appartiennent à l'App Store : ne rien enregistrer laisse `supportsAppUpdates()`
 * à faux, donc la bannière absente — le comportement juste, obtenu sans une
 * ligne de conditionnel côté page.
 */

import { shell } from "electron";
import { z } from "zod";
import { sendToPage } from "../pageEvents";
import { nativeHandle } from "../video/native";
import { getMainWindow } from "../window";
import { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();

/** Page de mises à jour du Store — le repli qui fonctionne toujours. */
const PAGE_MISES_A_JOUR = "ms-windows-store://downloadsandupdates";

/**
 * WinRT à la demande.
 *
 * ⚠️ `msixUpdate` remonte à `winrt/com.ts`, qui charge `combase.dll` à l'import.
 * Un `import` en tête de fichier ferait donc tomber le processus principal sur
 * macOS — alors même que la garde ci-dessous n'aurait rien enregistré.
 */
function msix(): typeof import("../msixUpdate") {
  return require("../msixUpdate") as typeof import("../msixUpdate");
}

export function registerUpdateCommands(registry: CommandRegistry): void {
  if (process.platform !== "win32") return;

  registry
    .add("check_msix_update", {
      schema: NO_ARGS,
      run: async () => {
        try {
          return await msix().checkMsixUpdate();
        } catch (error) {
          // Une recherche qui échoue n'est pas une mise à jour absente, mais la
          // page ne peut rien en faire d'autre : elle n'affiche rien.
          console.warn(`[maj] recherche impossible : ${String(error)}`);
          return null;
        }
      },
    })
    .add("download_and_install_msix_update", {
      schema: NO_ARGS,
      run: async () => {
        const win = getMainWindow();
        if (!win) throw new Error("aucune fenetre pour la boite de dialogue du Store");

        // La progression réelle demanderait un délégué WinRT, c'est-à-dire un
        // objet COM complet fabriqué à la main. Le Store affiche de toute façon
        // sa propre progression : on annonce le départ et l'arrivée, ce qui
        // suffit à la barre de la page.
        sendToPage("msix-update-progress", { progress: 0 });
        try {
          await msix().downloadAndInstallMsixUpdate(nativeHandle(win));
          sendToPage("msix-update-progress", { progress: 1 });
        } catch (error) {
          // Repli : la page de mises à jour du Store. L'utilisateur obtient sa
          // mise à jour dans tous les cas — seul le chemin change.
          console.warn(`[maj] installation directe impossible (${String(error)}), ouverture du Store`);
          await shell.openExternal(PAGE_MISES_A_JOUR);
          // On lève quand même : la page ne doit PAS enchaîner sur un
          // redémarrage, puisque rien n'a encore été installé.
          throw new Error("store-page-opened");
        }
      },
    });
}
