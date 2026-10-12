/**
 * Le port du serveur : libre ou pas, et lesquels proposer à la place.
 *
 * L'hôte le teste AVANT de lancer le serveur : un `EADDRINUSE` du serveur
 * (`startup-failed` / `port_in_use`) n'est que le filet d'une course.
 */
import { createServer } from "node:net";

export const DEFAULT_PORT = 3000;

/** Ports proposés quand le nôtre est pris : courants, faciles à retenir. */
export const PORT_CANDIDATES = [3000, 3100, 3200, 8000, 8080, 8090, 8200, 9000] as const;

export function isValidPort(port: unknown): port is number {
  return typeof port === "number" && Number.isInteger(port) && port >= 1024 && port <= 65535;
}

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Libre pour le serveur (`HOST=0.0.0.0`) ET sur la boucle locale : une app qui
 * n'écoute que sur 127.0.0.1 laisserait passer le premier test, puis capterait
 * tout ce que ce PC envoie à `localhost`.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (await canListen(port, "0.0.0.0")) && (await canListen(port, "127.0.0.1"));
}

/** Jusqu'à `count` ports libres parmi les candidats, sans le port actuel. */
export async function suggestPorts(
  current: number,
  isFree: (port: number) => Promise<boolean> = isPortFree,
  count = 4,
): Promise<number[]> {
  const free: number[] = [];
  for (const port of PORT_CANDIDATES) {
    if (port === current) continue;
    if (await isFree(port)) free.push(port);
    if (free.length >= count) break;
  }
  return free;
}
