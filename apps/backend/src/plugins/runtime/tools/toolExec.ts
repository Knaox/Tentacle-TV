import { execFile } from "child_process";
import { existsSync, statSync } from "fs";
import { delimiter, dirname, isAbsolute, join } from "path";
import { ytDlpCommand } from "../../../services/ytDlp";
import { isZipapp, ytDlpInvocation } from "../../../services/tools/toolPaths";
import { HostCallFailure } from "../hostDispatcher";
import type { ToolName } from "../pluginServerRuntime";
import { validateYtDlpArgs } from "./ytDlpPolicy";

/**
 * Lancer un outil POUR une extension : le binaire du cœur (yt-dlp tel que
 * `services/ytDlp.ts` le tient à jour — chemin et mises à jour inchangés, les
 * bandes-annonces n'y voient rien), jamais un chemin donné par l'extension ;
 * des arguments passés par la politique de l'outil ; un environnement VIDÉ
 * (seul le dossier de Node dans le PATH, pour le solveur JavaScript de yt-dlp) ;
 * le dossier de données de l'extension pour dossier courant.
 */

const MAX_OUTPUT = 16 * 1024 * 1024;

/** L'environnement d'un outil : rien du serveur (ni clé, ni `DATABASE_URL`), le Node du serveur trouvable. */
export function toolEnv(): Record<string, string> {
  // YTDLP_NO_PLUGINS : yt-dlp ne charge aucun greffon (ceux posés à côté du zipapp compris).
  const env: Record<string, string> = { PATH: dirname(process.execPath), YTDLP_NO_PLUGINS: "1", TENTACLE_NODE: process.execPath };
  for (const name of ["TZ", "LANG", "LC_ALL", "SystemRoot"]) {
    const value = process.env[name];
    if (value) env[name] = value;
  }
  return env;
}

/** Le fichier de `command` : un chemin, ou un nom cherché dans le PATH. */
export function resolveCommand(command: string): string | null {
  if (isAbsolute(command)) return existsSync(command) ? command : null;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, command);
    if (dir && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Le zipapp en service, ou `null` (yt-dlp de développement, absent). */
export function activeYtDlpZipapp(): string | null {
  const file = resolveCommand(ytDlpCommand());
  return file && isZipapp(file) ? file : null;
}

let versionCache: { signature: string; version: string | null } | null = null;

/** La version de yt-dlp en service (mémorisée tant que le fichier ne change pas). */
export async function ytDlpVersion(): Promise<string | null> {
  const file = resolveCommand(ytDlpCommand());
  if (!file) return null;
  const signature = `${file}:${statSync(file).mtimeMs}`;
  if (versionCache?.signature === signature) return versionCache.version;
  const { file: program, args } = ytDlpInvocation(file);
  const version = await new Promise<string | null>((done) => {
    execFile(resolveCommand(program) ?? program, [...args, "--version"], { timeout: 30_000, env: toolEnv() }, (err, stdout) => done(err ? null : stdout.trim().slice(0, 40) || null));
  });
  versionCache = { signature, version };
  return version;
}

export async function execTool(
  tool: ToolName,
  args: string[],
  timeoutMs: number,
  dataDir: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  if (tool !== "yt-dlp") throw new HostCallFailure("invalid", "outil inconnu");
  const policy = validateYtDlpArgs(args, dataDir);
  if (!policy.ok) throw new HostCallFailure("forbidden", policy.reason);
  const file = resolveCommand(ytDlpCommand());
  if (!file) throw new HostCallFailure("unavailable", "yt-dlp absent de ce serveur");
  const invocation = ytDlpInvocation(file);
  // L'interpréteur (zipapp) cherché dans le PATH du SERVEUR : celui de l'outil ne garde que le dossier de Node.
  const program = resolveCommand(invocation.file) ?? invocation.file;
  return new Promise((done) => {
    execFile(
      program,
      [...invocation.args, ...policy.args],
      { cwd: dataDir, env: toolEnv(), timeout: timeoutMs, maxBuffer: MAX_OUTPUT, windowsHide: true },
      (err, stdout, stderr) => {
        const failure = err as (NodeJS.ErrnoException & { code?: number | string; killed?: boolean }) | null;
        const code = failure ? (typeof failure.code === "number" ? failure.code : failure.killed ? 124 : 1) : 0;
        done({ code, stdout: String(stdout), stderr: String(stderr).slice(-64 * 1024) });
      },
    );
  });
}
