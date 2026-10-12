/**
 * « Démarrer avec Windows » HORS paquet (prototype, essais sur un PC de dev) :
 * la clé `Run` du compte. Le paquet MSIX, lui, passe par sa `StartupTask`
 * (`startupTask.ts`) — une app empaquetée n'a pas à écrire dans `Run`.
 *
 * Le Gestionnaire des tâches désactive une entrée sans la supprimer, dans
 * `StartupApproved\Run` (premier octet impair = désactivée) : c'est notre
 * `disabled-by-user`, comme pour la `StartupTask`.
 *
 * `reg.exe` par son chemin absolu : signé, sans FFI vers le registre.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";
import type { StartupState } from "../tray/menuModel";

export const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
export const APPROVED_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
export const VALUE_NAME = "Tentacle Server";

/**
 * La commande enregistrée : le même Node, le même hôte, la même racine — et
 * `--autostart`, qui dit à l'hôte qu'il part avec la session (pas d'écran de
 * démarrage s'il n'a rien à dire). Une entrée d'avant, sans lui, reste lue
 * comme « activée ».
 */
export function runCommand(execPath: string, hostScript: string, appRoot: string): string {
  return `"${execPath}" "${hostScript}" --app-root "${appRoot}" --autostart`;
}

/** Lit la donnée d'une ligne `reg query` : `    Nom    REG_TYPE    donnée`. */
export function parseRegValue(output: string, name: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(name)) continue;
    const match = /^(.*?)\s{4}(REG_\w+)\s{4}(.*)$/.exec(trimmed);
    if (match && match[1] === name) return match[3] ?? "";
  }
  return null;
}

/** `StartupApproved` : `02…` activée, `03…` désactivée par l'utilisateur. */
export function approvedDisabled(binary: string | null): boolean {
  if (binary === null || binary.length < 2) return false;
  return (Number.parseInt(binary.slice(0, 2), 16) & 1) === 1;
}

export class RunKeyStartup {
  private readonly reg: string;

  constructor(
    systemRoot: string,
    private readonly command: string,
  ) {
    this.reg = join(systemRoot, "System32", "reg.exe");
  }

  async read(): Promise<StartupState> {
    const value = parseRegValue(await this.query(RUN_KEY), VALUE_NAME);
    if (value === null) return "disabled";
    return approvedDisabled(parseRegValue(await this.query(APPROVED_KEY), VALUE_NAME)) ? "disabled-by-user" : "enabled";
  }

  async set(enabled: boolean): Promise<StartupState> {
    if (enabled) {
      await this.run(["add", RUN_KEY, "/v", VALUE_NAME, "/t", "REG_SZ", "/d", this.command, "/f"]);
      // Une désactivation passée dans le Gestionnaire des tâches l'emporterait encore.
      await this.run(["delete", APPROVED_KEY, "/v", VALUE_NAME, "/f"]).catch(() => undefined);
    } else {
      await this.run(["delete", RUN_KEY, "/v", VALUE_NAME, "/f"]).catch(() => undefined);
    }
    return this.read();
  }

  private query(key: string): Promise<string> {
    return this.run(["query", key, "/v", VALUE_NAME]).catch(() => "");
  }

  private run(args: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this.reg, args, { windowsHide: true, encoding: "utf8" }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
}
