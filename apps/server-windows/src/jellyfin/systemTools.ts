/**
 * Les outils de Windows que la détection de Jellyfin interroge : `reg.exe`,
 * `sc.exe`, `tasklist.exe` — par leur chemin absolu (signés, jamais un homonyme
 * trouvé dans le `PATH`), sans console, sans FFI vers le registre.
 *
 * `run` ne rejette jamais : un outil absent ou en échec rend son code et sa
 * sortie, et la règle qui le lit décide.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";

export interface ToolResult {
  /** `null` : l'outil n'a pas pu être lancé. */
  code: number | null;
  stdout: string;
}

export type ToolRunner = (tool: "reg" | "sc" | "tasklist", args: readonly string[]) => Promise<ToolResult>;

export function systemToolRunner(systemRoot: string): ToolRunner {
  const exe = { reg: "reg.exe", sc: "sc.exe", tasklist: "tasklist.exe" } as const;
  return (tool, args) =>
    new Promise((resolve) => {
      execFile(join(systemRoot, "System32", exe[tool]), args, { windowsHide: true, encoding: "utf8", timeout: 10_000 }, (error, stdout) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : null;
        resolve({ code, stdout: stdout ?? "" });
      });
    });
}

/**
 * Les valeurs d'une clé, lues dans la sortie de `reg query <clé>` :
 * `    Nom    REG_TYPE    donnée`. Les sous-clés et l'en-tête sont ignorés.
 */
export function parseRegKey(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s{2,}(.+?)\s{4}(REG_\w+)\s{4}(.*)$/.exec(line);
    if (match?.[1] !== undefined) values[match[1]] = (match[3] ?? "").trim();
  }
  return values;
}

/**
 * L'état d'un service lu dans `sc query <nom>` : `STATE : 4 RUNNING`. Le
 * libellé de la ligne peut être traduit ; le code et son nom ne le sont pas.
 * Code 1060 : il n'existe pas.
 */
export function parseServiceState(result: ToolResult): "running" | "stopped" | "absent" {
  if (result.code === 1060) return "absent";
  const match = /:\s*(\d)\s+(?:STOPPED|START_PENDING|STOP_PENDING|RUNNING|CONTINUE_PENDING|PAUSE_PENDING|PAUSED)\b/.exec(result.stdout);
  if (!match) return result.code === 0 ? "stopped" : "absent";
  // 2 START_PENDING et 4 RUNNING : il tourne, ou va tourner.
  return match[1] === "4" || match[1] === "2" ? "running" : "stopped";
}

/** `tasklist /FO CSV /NH` : une ligne par processus, le nom en première colonne, entre guillemets. */
export function processListed(output: string, image: string): boolean {
  const wanted = `"${image.toLowerCase()}"`;
  return output.split(/\r?\n/).some((line) => line.toLowerCase().startsWith(wanted));
}
