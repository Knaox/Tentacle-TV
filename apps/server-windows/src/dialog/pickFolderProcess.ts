/**
 * `dialog.pickFolder` : la boîte « Choisir un dossier », ouverte dans un
 * PROCESSUS À PART — le même exécutable, relancé en mode `--pick-folder` —
 * pour que sa boucle modale ne fige jamais l'hôte (cf. `folderDialog.ts`).
 *
 * Les paramètres passent en JSON encodé en base64 (aucun souci de guillemets
 * dans la ligne de commande), le résultat revient en une ligne JSON sur la
 * sortie standard. Une seule boîte à la fois : un second appel pendant qu'elle
 * est ouverte reçoit la même réponse.
 */
import { spawn } from "node:child_process";
import { parsePickFolderParams, type PickFolderParams, type PickFolderResult } from "../protocol";

export const PICK_FOLDER_FLAG = "--pick-folder";

export function encodePickParams(params: PickFolderParams): string {
  return Buffer.from(JSON.stringify(params), "utf8").toString("base64");
}

export function decodePickParams(encoded: string | undefined): PickFolderParams {
  if (!encoded) return {};
  try {
    return parsePickFolderParams(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")));
  } catch {
    return {};
  }
}

/** La dernière ligne JSON de la sortie du processus de la boîte ; `null` si illisible. */
export function readPickOutput(stdout: string): PickFolderResult | null {
  const line = stdout.trim().split(/\r?\n/).at(-1) ?? "";
  try {
    const raw = JSON.parse(line) as { path?: unknown; unc?: unknown };
    if (raw.path === null) return { path: null };
    if (typeof raw.path !== "string" || raw.path === "") return null;
    return { path: raw.path, unc: typeof raw.unc === "string" && raw.unc !== "" ? raw.unc : null };
  } catch {
    return null;
  }
}

export class FolderPicker {
  private pending: Promise<PickFolderResult> | null = null;

  constructor(
    private readonly execPath: string,
    private readonly hostScript: string,
    private readonly log: (line: string) => void,
  ) {}

  pick(params: PickFolderParams, timeoutMs: number): Promise<PickFolderResult> {
    this.pending ??= this.open(params, timeoutMs).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private open(params: PickFolderParams, timeoutMs: number): Promise<PickFolderResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.execPath, [this.hostScript, PICK_FOLDER_FLAG, encodePickParams(params)], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
      // Oubliée à l'écran : la boîte se ferme d'elle-même, comme une annulation.
      const timer = setTimeout(() => child.kill(), timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        const result = readPickOutput(stdout);
        if (result) {
          resolve(result);
          return;
        }
        if (stderr.trim()) this.log(`boîte « Choisir un dossier » : ${stderr.trim().split(/\r?\n/).at(-1) ?? ""}`);
        if (code === null) resolve({ path: null });
        else reject(new Error(`boîte « Choisir un dossier » sortie en ${code}`));
      });
    });
  }
}

/** Le mode `--pick-folder` de l'exécutable : la boîte, une ligne JSON, et la sortie. */
export async function runPickFolderChild(encoded: string | undefined): Promise<never> {
  const { showFolderDialog } = await import("./folderDialog");
  try {
    const result = showFolderDialog(decodePickParams(encoded));
    await new Promise<void>((resolve) => process.stdout.write(`${JSON.stringify(result)}\n`, () => resolve()));
    process.exit(0);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
