/**
 * L'hôte en mode ligne de commande : lance `cli/tentacle.js` du serveur avec
 * l'environnement du serveur (`TENTACLE_DATA_DIR`, port, outils), relaie sa
 * sortie vers la console du shell, et rend son code.
 *
 * Rien de l'hôte ne démarre ici : ni instance unique, ni icône, ni dossier de
 * données créé (la commande le trouve, ou dit qu'il n'y a rien à faire).
 *
 * La commande est elle aussi un processus GUI : un descripteur de console ne
 * lui servirait à rien (relevé sur ce PC — rien ne paraît). Sa sortie passe
 * donc par des tubes, et c'est l'hôte, attaché à la console du shell, qui
 * l'y écrit. Aucune commande ne lit l'entrée standard.
 */
import { spawn, type StdioOptions } from "node:child_process";

export interface CliLaunch {
  execPath: string;
  entry: string;
  cwd: string;
  args: readonly string[];
  env: Record<string, string>;
}

export interface CliConsole {
  /** La sortie héritée est un fichier ou un tube (une console exige `AttachConsole`). */
  stdoutRedirected(): boolean;
  /** S'attache à la console du shell ; rend de quoi y écrire, ou `null`. */
  attachParentConsole(): ((text: string) => void) | null;
  /** Montre la sortie recueillie quand aucune console n'existe. */
  showOutput(text: string, failed: boolean): void;
}

/** Le texte d'une sortie recueillie, borné pour une boîte de message. */
export function boxText(output: string, limit = 3000): string {
  const text = output.trim();
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}

/** Où va la sortie : héritée telle quelle, recopiée dans la console, ou montrée à la fin. */
type Sink = { kind: "inherit" } | { kind: "console"; write: (text: string) => void } | { kind: "box" };

function openSink(con: CliConsole): Sink {
  if (con.stdoutRedirected()) return { kind: "inherit" };
  const write = con.attachParentConsole();
  return write === null ? { kind: "box" } : { kind: "console", write };
}

export function runCli(launch: CliLaunch, con: CliConsole): Promise<number> {
  const sink = openSink(con);
  const stdio: StdioOptions = sink.kind === "inherit" ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"];
  return new Promise((resolve) => {
    let output = "";
    const emit = (text: string): void => {
      if (sink.kind === "console") sink.write(text);
      else output += text;
    };
    const child = spawn(launch.execPath, [launch.entry, ...launch.args], {
      cwd: launch.cwd,
      env: launch.env,
      stdio,
      windowsHide: true,
    });
    child.stdout?.setEncoding("utf8").on("data", emit);
    child.stderr?.setEncoding("utf8").on("data", emit);
    let done = false;
    const finish = (code: number, extra = ""): void => {
      if (done) return;
      done = true;
      if (extra !== "") emit(extra);
      if (sink.kind === "box" && output.trim() !== "") con.showOutput(boxText(output), code !== 0);
      resolve(code);
    };
    child.on("error", (error) => finish(1, `tentacle : ${error.message}\n`));
    // `close` et non `exit` : la sortie est alors lue jusqu'au bout.
    child.on("close", (code) => finish(code ?? 1));
  });
}
