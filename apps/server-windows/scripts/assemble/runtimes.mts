/**
 * Les exécutables embarqués : Node (devenu « Tentacle Server.exe »), Python
 * embarquable et le zipapp yt-dlp. Tout vient de `download.mts`, donc vérifié
 * par SHA-256 AVANT d'être extrait ; les archives s'ouvrent par le `tar` de
 * System32 (bsdtar, signé, lit le zip), jamais par un tar trouvé sur le PATH.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Log } from "./build.mts";
import { fetchPinned, fetchText } from "./download.mts";
import { NODE, PYTHON, shasumOf, ytDlpPin } from "./pins.mts";
import { SUBSYSTEM, readSubsystem, setSubsystem } from "./peSubsystem.mts";

/** Le nom de l'exe dans le paquet : lisible dans le pare-feu et le Gestionnaire des tâches. */
export const SERVER_EXE = "Tentacle Server.exe";

function systemTar(): string {
  return join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
}

function extract(archive: string, target: string, members: readonly string[] = []): void {
  mkdirSync(target, { recursive: true });
  execFileSync(systemTar(), ["-xf", archive, "-C", target, ...members], { stdio: "inherit" });
}

/** `node.exe` officiel, recoupé avec `SHASUMS256.txt`, renommé et passé en sous-système GUI. */
export async function installNode(root: string, cacheDir: string, log: Log): Promise<void> {
  const shasums = await fetchText(NODE.shasumsUrl);
  const listed = shasumOf(shasums, NODE.fileName);
  if (listed !== NODE.sha256) {
    throw new Error(`Node ${NODE.version} : SHASUMS256.txt dit ${listed ?? "rien"}, l'épingle ${NODE.sha256}`);
  }
  const archive = await fetchPinned(NODE, cacheDir, log);
  const work = mkdtempSync(join(cacheDir, "node-"));
  try {
    extract(archive, work, [`${NODE.folder}/node.exe`, `${NODE.folder}/LICENSE`]);
    const image = readFileSync(join(work, NODE.folder, "node.exe"));
    const before = setSubsystem(image, SUBSYSTEM.GUI);
    if (before !== SUBSYSTEM.CONSOLE) throw new Error(`node.exe : sous-système ${before} inattendu`);
    if (readSubsystem(image) !== SUBSYSTEM.GUI) throw new Error("node.exe : sous-système non réécrit");
    writeFileSync(join(root, SERVER_EXE), image);
    mkdirSync(join(root, "third-party", "node"), { recursive: true });
    copyFileSync(join(work, NODE.folder, "LICENSE"), join(root, "third-party", "node", "LICENSE"));
    log(`${SERVER_EXE} : Node ${NODE.version}, sous-système GUI`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Python embarquable dans `python\` (`appLayout.ts` le cherche là). */
export async function installPython(root: string, cacheDir: string, log: Log): Promise<void> {
  const archive = await fetchPinned(PYTHON, cacheDir, log);
  extract(archive, join(root, "python"));
  log(`python : ${PYTHON.version} embarquable`);
}

/** Le zipapp yt-dlp dans `tools\yt-dlp`, aux version et empreinte du Dockerfile. */
export async function installYtDlp(root: string, dockerfile: string, cacheDir: string, log: Log): Promise<string> {
  const pin = ytDlpPin(dockerfile);
  const file = await fetchPinned(pin, cacheDir, log);
  mkdirSync(join(root, "tools"), { recursive: true });
  copyFileSync(file, join(root, "tools", "yt-dlp"));
  return pin.version;
}

/** Le zipapp tourne-t-il avec le Python du paquet ? (même contrôle que le Dockerfile) */
export function checkYtDlp(root: string, expected: string): void {
  const version = execFileSync(join(root, "python", "python.exe"), ["-I", join(root, "tools", "yt-dlp"), "--version"], {
    encoding: "utf8",
  }).trim();
  if (version !== expected) throw new Error(`yt-dlp : ${version}, attendu ${expected}`);
}
