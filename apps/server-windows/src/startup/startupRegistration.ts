/**
 * « Démarrer avec Windows » : la `StartupTask` dans le paquet MSIX, la clé
 * `Run` du compte hors paquet. Le reste de l'hôte ne voit que cette interface.
 */
import type { StartupState } from "../tray/menuModel";
import { RunKeyStartup } from "./runKey";

export interface StartupRegistration {
  read(): Promise<StartupState>;
  set(enabled: boolean): Promise<StartupState>;
}

export async function startupRegistration(options: {
  packaged: boolean;
  systemRoot: string;
  command: string;
}): Promise<StartupRegistration> {
  if (options.packaged) {
    const task = await import("./startupTask");
    return { read: task.readStartupTask, set: task.setStartupTask };
  }
  return new RunKeyStartup(options.systemRoot, options.command);
}
