/**
 * L'environnement du serveur, en LISTE BLANCHE.
 *
 * Docker isole l'environnement ; un processus Windows hérite de celui de la
 * machine. Un `DATABASE_URL` ou des `DB_*` hérités feraient passer une
 * installation neuve en migration MariaDB, un `PATH` d'utilisateur ferait
 * prendre le tar de Git ou l'amorce `python3` du Store. Rien n'est donc
 * hérité hors de `INHERITED`, et le reste reprend le `Dockerfile` (étape
 * `server`) : protocole IPC du fil A, § 5.
 */

/** Ce que Node et les outils système de Windows attendent de la session. */
export const INHERITED = [
  "SystemRoot",
  "SystemDrive",
  "windir",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "COMPUTERNAME",
  "USERNAME",
  "USERDOMAIN",
] as const;

export interface ServerEnvInput {
  /** L'environnement de l'hôte (en pratique `process.env`). */
  source: Readonly<Record<string, string | undefined>>;
  port: number;
  /** `%ProgramData%\Tentacle Server`. */
  dataDir: string;
  /** `<données>\cache`, pour yt-dlp. */
  cacheDir: string;
  /** Python embarquable du paquet ; absent hors paquet (le serveur garde `python3`). */
  python?: string;
  /** Le zipapp yt-dlp épinglé du paquet ; absent hors paquet. */
  ytDlpPinned?: string;
  /** Dossiers à placer DEVANT le `PATH` système (outils du paquet). */
  extraPath?: readonly string[];
}

/** Lecture insensible à la casse : Windows l'est, un objet JS non. */
export function readEnv(source: ServerEnvInput["source"], key: string): string | undefined {
  const wanted = key.toLowerCase();
  for (const [name, value] of Object.entries(source)) {
    if (name.toLowerCase() === wanted && value !== undefined && value !== "") return value;
  }
  return undefined;
}

/**
 * Le `PATH` SYSTÈME seul, recomposé depuis `SystemRoot` : jamais celui de
 * l'utilisateur (Git, MSYS, l'amorce `python3` de `WindowsApps`).
 */
export function systemPath(systemRoot: string, extra: readonly string[] = []): string {
  const root = systemRoot.replace(/[\\/]+$/, "");
  return [
    ...extra,
    `${root}\\System32`,
    root,
    `${root}\\System32\\Wbem`,
    `${root}\\System32\\WindowsPowerShell\\v1.0`,
  ].join(";");
}

export function buildServerEnv(input: ServerEnvInput): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of INHERITED) {
    const value = readEnv(input.source, key);
    if (value !== undefined) env[key] = value;
  }
  const systemRoot = env.SystemRoot ?? "C:\\Windows";
  env.SystemRoot = systemRoot;
  env.PATH = systemPath(systemRoot, input.extraPath);

  // Le `Dockerfile` (ENV de l'étape `server`), puis ce qui est propre à Windows.
  env.NODE_ENV = "production";
  env.PORT = String(input.port);
  env.HOST = "0.0.0.0";
  env.TENTACLE_DEPLOYMENT = "windows-app";
  env.TENTACLE_DATA_DIR = input.dataDir;
  env.XDG_CACHE_HOME = input.cacheDir;
  if (input.python !== undefined) env.TENTACLE_PYTHON = input.python;
  if (input.ytDlpPinned !== undefined) env.TENTACLE_YTDLP_PINNED = input.ytDlpPinned;
  return env;
}
