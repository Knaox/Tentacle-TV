import { createSocket, type RemoteInfo, type Socket } from "dgram";
import { isIP } from "net";

/**
 * La découverte de Jellyfin par UDP : le message `who is JellyfinServer?` sur
 * le port 7359, auquel chaque Jellyfin répond par un JSON (`Address`, `Id`,
 * `Name`). Envoyé en diffusion ET à chaque hôte candidat : depuis un réseau
 * Docker en pont, la diffusion ne sort pas du conteneur, l'envoi direct si.
 *
 * Borné : une socket, une fenêtre d'écoute, un nombre de réponses. De la
 * réponse, seuls comptent l'adresse d'où elle vient et le PORT annoncé —
 * l'adresse annoncée est celle que Jellyfin croit avoir (dans un conteneur,
 * une IP Docker injoignable d'ici). Ce n'est qu'une piste : la sonde HTTP
 * dira ensuite ce qu'il y a vraiment.
 */
export const DISCOVERY_PORT = 7359;
const MESSAGE = Buffer.from("who is JellyfinServer?");
const MAX_REPLIES = 16;

export interface UdpCandidate {
  /** L'adresse d'où vient la réponse. */
  host: string;
  port: number;
  protocol: "http:" | "https:";
}

export interface UdpResult {
  candidates: UdpCandidate[];
  outcome: "answered" | "silent" | "unavailable";
}

/** Le port et le protocole annoncés dans `Address` ; 8096 en http s'il est illisible. */
export function readReply(message: Buffer, remote: RemoteInfo): UdpCandidate | null {
  if (message.length > 4096 || isIP(remote.address) === 0) return null;
  let address: string;
  try {
    const json = JSON.parse(message.toString("utf-8")) as { Address?: unknown; Id?: unknown };
    if (typeof json.Id !== "string") return null;
    address = typeof json.Address === "string" ? json.Address : "";
  } catch {
    return null;
  }
  let port = 8096;
  let protocol: UdpCandidate["protocol"] = "http:";
  try {
    const url = new URL(address);
    if (url.protocol === "https:") protocol = "https:";
    if (url.port) port = Number(url.port);
    else if (protocol === "https:") port = 443;
  } catch {
    /* adresse annoncée illisible : le port par défaut */
  }
  return { host: remote.address.replace(/^::ffff:/, ""), port, protocol };
}

export interface UdpOptions {
  /** Les hôtes à interroger directement, en plus de la diffusion. */
  unicast: string[];
  listenMs?: number;
  createSocket?: () => Socket;
}

export function discoverByUdp(options: UdpOptions): Promise<UdpResult> {
  return new Promise((resolve) => {
    const found = new Map<string, UdpCandidate>();
    let socket: Socket;
    let settled = false;
    const finish = (outcome?: UdpResult["outcome"]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* déjà fermée */
      }
      const candidates = [...found.values()];
      resolve({ candidates, outcome: outcome ?? (candidates.length ? "answered" : "silent") });
    };
    const timer = setTimeout(() => finish(), options.listenMs ?? 1_500);
    try {
      socket = (options.createSocket ?? (() => createSocket({ type: "udp4", reuseAddr: true })))();
    } catch {
      finish("unavailable");
      return;
    }
    socket.on("error", () => finish(found.size ? "answered" : "unavailable"));
    socket.on("message", (message, remote) => {
      const candidate = readReply(message, remote);
      if (candidate) found.set(`${candidate.host}:${candidate.port}`, candidate);
      if (found.size >= MAX_REPLIES) finish();
    });
    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
      } catch {
        /* diffusion refusée : l'envoi direct reste */
      }
      const targets = ["255.255.255.255", ...options.unicast.filter((host) => isIP(host) === 4)];
      for (const host of new Set(targets)) socket.send(MESSAGE, DISCOVERY_PORT, host, () => undefined);
    });
  });
}
