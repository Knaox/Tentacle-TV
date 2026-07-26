/**
 * Preload — la seule porte entre la page et le processus principal.
 *
 * Contraintes du bac à sable (`sandbox: true`), qui dictent la forme de ce
 * fichier : il ne peut charger que `contextBridge`, `ipcRenderer`,
 * `crashReporter`, `nativeImage`, `webFrame`, `webUtils`, plus `events`,
 * `timers` et `url`. Ni `fs`, ni `child_process`. Et il doit être en CommonJS,
 * pas en ESM.
 *
 * On expose une surface étroite et TYPÉE, jamais `ipcRenderer` lui-même :
 * l'exposer reviendrait à donner au contenu de la page le droit d'appeler
 * n'importe quel canal du processus principal.
 *
 * ⚠️ Ce fichier est BUNDLÉ par esbuild (`build:preload`). Un preload en bac à
 * sable ne peut charger que la poignée de modules autorisés par Electron :
 * tout `require` de nos propres fichiers échoue avec « module not found », et
 * la page se retrouve sans pont, écran noir. La liste des canaux doit donc
 * être inlinée dans le bundle, jamais chargée à l'exécution.
 */

import { contextBridge, ipcRenderer } from "electron";
import { isAllowedCommand, isAllowedEvent } from "../main/channels";

/** Injectés à la fabrication par le processus principal via `additionalArguments`. */
function argValue(prefix: string): string {
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

const version = argValue("--tentacle-version=");
const platform = argValue("--tentacle-platform=");

function assertPlatform(value: string): "win32" | "darwin" | "linux" {
  return value === "darwin" || value === "linux" ? value : "win32";
}

contextBridge.exposeInMainWorld("tentacle", {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!isAllowedCommand(command)) {
      return Promise.reject(new Error(`canal refuse: ${command}`));
    }
    return ipcRenderer.invoke(`tentacle:${command}`, args ?? {});
  },

  on(event: string, handler: (payload: unknown) => void): () => void {
    if (!isAllowedEvent(event)) return () => undefined;
    // L'objet `IpcRendererEvent` n'est JAMAIS transmis à la page : il porte
    // `sender` et `ports`, donc des références au processus principal.
    const wrapped = (_e: unknown, payload: unknown): void => handler(payload);
    ipcRenderer.on(`tentacle:${event}`, wrapped);
    return () => ipcRenderer.removeListener(`tentacle:${event}`, wrapped);
  },

  version,
  platform: assertPlatform(platform),

  openExternal(url: string): Promise<void> {
    // Le filtrage des schémas est fait côté principal, jamais ici : une liste
    // blanche qui vit dans la page ne protège de rien.
    return ipcRenderer.invoke("tentacle:open-external", url) as Promise<void>;
  },

  pickFolder(): Promise<string | null> {
    return ipcRenderer.invoke("tentacle:pick-folder") as Promise<string | null>;
  },

  relaunch(): Promise<void> {
    return ipcRenderer.invoke("tentacle:relaunch") as Promise<void>;
  },
});
