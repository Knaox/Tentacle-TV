/**
 * Commandes de mise à jour applicative (Microsoft Store).
 *
 * Enregistrer `check_msix_update` fait passer `supportsAppUpdates()` à vrai
 * côté page : la bannière et le bouton « Mettre à jour » réapparaissent.
 * Aucune modification d'`apps/web` — `useAutoUpdate` et `updateCheckers` sont
 * déjà écrits pour ce contrat.
 *
 * **Windows uniquement, et c'est voulu** — mais PAS pour la raison qu'on
 * pourrait croire.
 *
 * ⚠️ Ce fichier a longtemps affirmé que macOS ne devait rien afficher, et que
 * l'absence de commande y suffisait. C'était le BUG, pas le comportement juste :
 * la pop-up ne s'affichait jamais sur macOS alors que tout ce qu'il lui faut
 * existe — un manifeste à lire et une fiche App Store à ouvrir.
 *
 * `supportsAppUpdates()` (`apps/web/src/desktop/capabilities.ts`) court-circuite
 * désormais l'inventaire des commandes quand le canal de distribution est
 * `appstore` : sur macOS la mise à jour n'est pas une commande native mais un
 * `fetch` et un `openExternal`, et il n'y a donc rien à enregistrer ici. Les
 * commandes ci-dessous restent ce qu'elles ont toujours été : la voie WinRT du
 * Microsoft Store, qui n'a pas d'équivalent ailleurs.
 */

import { shell } from "electron";
import { z } from "zod";
import { sendToPage } from "../pageEvents";
import { nativeHandle } from "../video/native";
import { getMainWindow } from "../window";
import { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();

/** Page de mises à jour du Store — le repli qui fonctionne toujours. */
const UPDATES_PAGE = "ms-windows-store://downloadsandupdates";

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

/**
 * Les trois commandes de Linux.
 *
 * ⚠️ Chargement paresseux, comme WinRT juste au-dessus : rien de tout cela ne
 * doit être importé sur les autres systèmes.
 */
function registerLinuxUpdateCommands(registry: CommandRegistry): void {
  const linuxUpdate = require("../linux/update") as typeof import("../linux/update");
  registry
    .add("detect_linux_install_format", {
      schema: NO_ARGS,
      run: () => linuxUpdate.detectFormat(),
    })
    .add("download_update", {
      schema: z.object({
        url: z.string().url(),
        sha256: z.string(),
        fileName: z.string().min(1),
      }),
      run: ({ url, sha256, fileName }) =>
        linuxUpdate.download({
          url,
          sha256,
          fileName,
          // Le même nom d'évènement que côté Tauri : la page écoute déjà.
          onProgress: (f) => { sendToPage("linux-update-progress", f); },
        }),
    })
    .add("install_linux_update", {
      schema: z.object({
        path: z.string().min(1),
        format: z.enum(["appimage", "deb", "rpm", "pacman"]),
      }),
      run: ({ path, format }) => linuxUpdate.install(path, format),
    });
}

export function registerUpdateCommands(registry: CommandRegistry): void {
  if (process.platform === "linux") {
    registerLinuxUpdateCommands(registry);
    return;
  }
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

        // La progression réelle demanderait un délégué WinRT : un objet COM
        // fabriqué à la main, dont l'`Invoke` est appelé depuis un fil de la
        // réserve — là où un pont FFI ne peut pas rappeler du JavaScript. Le
        // Store affiche de toute façon sa propre progression.
        //
        // On l'ANNONCE désormais à la page (`indeterminate`) au lieu de la
        // laisser déduire un avancement de deux valeurs. Elle affichait un 0 %
        // figé pendant tout le téléchargement, ce qui se lit comme une panne ;
        // elle fait maintenant balayer sa barre, ce qui est la vérité : il se
        // passe quelque chose, on ne sait pas où ça en est.
        sendToPage("msix-update-progress", { progress: 0, indeterminate: true });
        try {
          await msix().downloadAndInstallMsixUpdate(nativeHandle(win));
          sendToPage("msix-update-progress", { progress: 1, indeterminate: false });
        } catch (error) {
          // Repli : la page de mises à jour du Store. L'utilisateur obtient sa
          // mise à jour dans tous les cas — seul le chemin change.
          console.warn(`[maj] installation directe impossible (${String(error)}), ouverture du Store`);
          await shell.openExternal(UPDATES_PAGE);
          // On lève quand même : la page ne doit PAS enchaîner sur un
          // redémarrage, puisque rien n'a encore été installé.
          throw new Error("store-page-opened");
        }
      },
    });
}
