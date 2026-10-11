/**
 * Une seule instance de l'hôte, par tube nommé.
 *
 * Le premier lancement écoute sur le tube ; le second s'y connecte, demande
 * d'ouvrir l'administration, et quitte. C'est ce qui rend le second clic sur
 * la tuile du menu Démarrer utile au lieu de dangereux : une seconde instance
 * réécrirait le code d'installation et doublerait les tâches de fond (le
 * verrou `data/server.lock` du fil A garde en plus le serveur lui-même).
 *
 * Le tube vaut pour toute la machine, comme le dossier de données : un autre
 * compte qui lancerait l'app tombe sur la même instance.
 */
import { connect, createServer, type Server } from "node:net";

export const PIPE_NAME = "\\\\.\\pipe\\TentacleServer.host";

export type InstanceCommand = "open-admin";

export function parseCommand(line: string): InstanceCommand | null {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value === "object" && value !== null && (value as { command?: unknown }).command === "open-admin") return "open-admin";
  } catch {
    // Une ligne illisible ne vaut rien.
  }
  return null;
}

export type Acquired = { primary: true; server: Server } | { primary: false };

function listen(pipe: string, onCommand: (command: InstanceCommand) => void): Promise<Server | null> {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      socket.setEncoding("utf8");
      let buffer = "";
      socket.on("data", (chunk: string) => {
        buffer += chunk;
        if (buffer.length > 4096) socket.destroy();
        const end = buffer.indexOf("\n");
        if (end < 0) return;
        const command = parseCommand(buffer.slice(0, end));
        socket.end("ok\n");
        if (command !== null) onCommand(command);
      });
      socket.on("error", () => undefined);
    });
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") resolve(null);
      else reject(error);
    });
    server.listen(pipe, () => resolve(server));
  });
}

function sendToPrimary(pipe: string, command: InstanceCommand): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(pipe, () => socket.write(`${JSON.stringify({ command })}\n`));
    socket.setTimeout(3000, () => socket.destroy());
    socket.once("data", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("close", () => resolve(false));
  });
}

/**
 * Devient l'instance principale, ou passe la main à celle qui l'est. Un tube
 * occupé mais muet (instance en train de se fermer) : un second essai.
 */
export async function acquireInstance(onCommand: (command: InstanceCommand) => void, pipe = PIPE_NAME): Promise<Acquired> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const server = await listen(pipe, onCommand);
    if (server !== null) return { primary: true, server };
    if (await sendToPrimary(pipe, "open-admin")) return { primary: false };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { primary: false };
}
