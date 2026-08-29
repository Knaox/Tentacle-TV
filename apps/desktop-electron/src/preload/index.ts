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
import {
  MIGRATION_TAKE_CHANNEL,
  MIGRATION_REPORT_CHANNEL,
  isAllowedCommand,
  isAllowedEvent,
} from "../main/channels";

/** Injectés à la fabrication par le processus principal via `additionalArguments`. */
function argValue(prefix: string): string {
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

const version = argValue("--tentacle-version=");
const platform = argValue("--tentacle-platform=");

/**
 * Hauteur du bandeau d'hôte que la page doit dessiner, en points.
 *
 * Zéro partout où la fenêtre garde son vrai cadre. La valeur vient de
 * `main/macosTitleBar.ts`, seule à la connaître : elle place aussi les feux de
 * circulation et retranche à la fenêtre de mpv, et les trois doivent s'accorder
 * au point près. `Number.isFinite` écarte une valeur absente ou tordue plutôt
 * que de propager un `NaN` jusqu'à une hauteur CSS.
 */
const titleBarHeight = ((): number => {
  const raw = Number(argValue("--tentacle-titlebar="));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
})();

/**
 * Commandes réellement branchées côté principal.
 *
 * Gelées ici : la page ne doit pas pouvoir y ajouter un nom pour débloquer une
 * fonctionnalité absente. Le filtre écarte la chaîne vide que produirait un
 * `"".split(",")` quand aucune commande n'est encore livrée.
 */
const capabilities: readonly string[] = Object.freeze(
  argValue("--tentacle-commands=")
    .split(",")
    .filter((c) => c !== ""),
);

function assertPlatform(value: string): "win32" | "darwin" | "linux" {
  return value === "darwin" || value === "linux" ? value : "win32";
}

/**
 * Le montage vidéo de Linux, ou `undefined` ailleurs.
 *
 * Ce n'est pas une coquetterie de diagnostic : c'est lui qui dit si le HDR est
 * possible et si la lecture sera forcément en plein écran. La page ne peut pas
 * le déduire — elle ne voit qu'un `linux`.
 */
const montage = ((): "wayland" | "x11" | undefined => {
  const raw = argValue("--tentacle-montage=");
  return raw === "wayland" || raw === "x11" ? raw : undefined;
})();

/**
 * Le fenêtré Wayland : `libre` (la colle KWin cale la vidéo sous la fenêtre)
 * ou `plein-ecran` (compositeur sans placement — la lecture force le plein
 * écran). La page s'en sert pour ne montrer l'avis pédagogique que là où le
 * plein écran est réellement imposé.
 *
 * ⚠️ La CLÉ du pont reste `fenetrage` : la page la lit par chaîne
 * (`window.tentacle.fenetrage`). Seule la variable locale porte le nom anglais.
 */
const windowing = ((): "libre" | "plein-ecran" | undefined => {
  const raw = argValue("--tentacle-fenetrage=");
  return raw === "libre" || raw === "plein-ecran" ? raw : undefined;
})();

/**
 * Rejoue le stockage local sauvé par l'app Tauri, une fois pour toutes.
 *
 * C'est ICI et nulle part ailleurs : le preload s'exécute avant le premier
 * script de la page, et `localStorage` y est accessible même en bac à sable.
 * Le faire depuis `main.tsx` ferait démarrer l'application DÉCONNECTÉE avant de
 * se raviser. Le processus principal ne rend le dump qu'une fois — voir
 * `main/ipc/migration.ts` pour le reste du raisonnement.
 *
 * **On n'écrase JAMAIS une clé déjà là.** Sur une machine où l'application a
 * déjà servi, la session courante est la bonne ; la sauvegarde, elle, peut
 * dater. Sur une installation neuve — le cas de tous les utilisateurs qui
 * migrent — le stockage est vide et les deux comportements coïncident.
 */
function restoreLocalStorage(): void {
  let dump: unknown;
  try {
    dump = ipcRenderer.sendSync(MIGRATION_TAKE_CHANNEL);
  } catch {
    return;
  }
  if (dump === null || typeof dump !== "object") return;

  let written = 0;
  for (const [key, value] of Object.entries(dump as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    try {
      if (localStorage.getItem(key) !== null) continue;
      localStorage.setItem(key, value);
      written += 1;
    } catch {
      // Quota atteint ou stockage inaccessible : ce qui est passé reste, et le
      // rapport dira que le compte ne tombe pas juste.
      break;
    }
  }
  ipcRenderer.send(MIGRATION_REPORT_CHANNEL, written);
}

restoreLocalStorage();

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
  capabilities,
  ...(montage === undefined ? {} : { montage }),
  ...(windowing === undefined ? {} : { fenetrage: windowing }),
  titleBarHeight,

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
