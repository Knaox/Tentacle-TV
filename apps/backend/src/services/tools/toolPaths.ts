import { closeSync, existsSync, openSync, readSync } from "fs";
import { win32 } from "path";

/**
 * Les outils externes du serveur et où les trouver. Les DÉFAUTS sont ceux de
 * l'image Docker : rien n'y change. L'app Windows, qui embarque un Python et le
 * zipapp de yt-dlp dans son paquet, les pose par l'environnement.
 *
 * - `TENTACLE_PYTHON` : l'interpréteur (image : `python3`, celui d'Alpine) ;
 * - `TENTACLE_YTDLP_PINNED` : le zipapp épinglé et vérifié au build (image :
 *   `/usr/local/bin/yt-dlp`), le repli de la copie tenue à jour.
 */
export interface ToolEnv {
  TENTACLE_PYTHON?: string;
  TENTACLE_YTDLP_PINNED?: string;
}

const DOCKER_PYTHON = "python3";
const DOCKER_PINNED_YTDLP = "/usr/local/bin/yt-dlp";

export function pythonCommand(env: ToolEnv = process.env): string {
  return env.TENTACLE_PYTHON?.trim() || DOCKER_PYTHON;
}

export function pinnedYtDlpPath(env: ToolEnv = process.env): string {
  return env.TENTACLE_YTDLP_PINNED?.trim() || DOCKER_PINNED_YTDLP;
}

/** Le zipapp officiel : une ligne `#!…python3`, puis l'archive (`PK\x03\x04`). */
export function isZipapp(file: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(file, "r");
    const head = Buffer.alloc(256);
    const read = readSync(fd, head, 0, head.length, 0);
    const text = head.subarray(0, read);
    const newline = text.indexOf(0x0a);
    return text.subarray(0, 2).toString() === "#!" && newline > 0 && text.subarray(newline + 1, newline + 5).toString("latin1") === "PK\x03\x04";
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/**
 * Comment lancer yt-dlp : un zipapp passe TOUJOURS par l'interpréteur
 * (`[python, zipapp]`) — Windows n'exécute pas un shebang, et sous Linux c'est
 * exactement ce que fait le shebang. Tout autre exécutable (un yt-dlp de
 * Homebrew en développement, un nom cherché dans le PATH) se lance tel quel.
 */
export function ytDlpInvocation(command: string, env: ToolEnv = process.env): { file: string; args: string[] } {
  return existsSync(command) && isZipapp(command) ? { file: pythonCommand(env), args: [command] } : { file: command, args: [] };
}

/**
 * Le `tar` des extensions. Sous Windows, celui du système (bsdtar,
 * `System32\tar.exe`) par son chemin ABSOLU : par le nom, un tar de Git ou de
 * MSYS placé plus tôt dans le PATH serait pris, et il comprend « C: » comme un
 * hôte distant. Ailleurs, `tar` du PATH, comme toujours.
 */
export function tarCommand(env: { SystemRoot?: string } = process.env, platform: NodeJS.Platform = process.platform): string {
  if (platform !== "win32") return "tar";
  const systemTar = win32.join(env.SystemRoot?.trim() || "C:\\Windows", "System32", "tar.exe");
  return existsSync(systemTar) ? systemTar : "tar";
}
