import { lookup } from "dns/promises";
import { readFileSync } from "fs";
import { isIP } from "net";
import { networkInterfaces } from "os";
import type { Deployment } from "../deployment";
import { clientJellyfinUrl } from "../jellyfin/clientUrl";
import { probeJellyfin, type ProbedJellyfin } from "../jellyfin/probe";
import { assertStackSibling } from "../jellyfin/stackTarget";
import type { DiscoveredJellyfin, DiscoverySource, JellyfinDiscoveryResponse } from "../setupDiscoveryContract";
import { candidateHosts, formatHost, isScannableIp, parseDefaultGateway, SCAN_PORTS } from "./candidates";
import { discoverByUdp, type UdpResult } from "./udpDiscovery";

/**
 * `GET /api/setup/jellyfin/discover` : les Jellyfin joignables, chacun sondé
 * (nom, version, vierge ou non). Borné en temps et en nombre : quelques hôtes,
 * quelques ports, huit sondes à la fois, une seconde et demie chacune.
 *
 * Pile complète : le Jellyfin de la pile, et lui seul — pas d'autre choix.
 */
const PROBE_TIMEOUT_MS = 1_500;
const CONCURRENCY = 8;
const MAX_PROBES = 48;

export interface DiscoveryDeps {
  udp: (unicast: string[]) => Promise<UdpResult>;
  probe: (url: string) => Promise<ProbedJellyfin>;
  gateway: () => string | null;
  dockerHostAddresses: () => Promise<string[]>;
  /** Les adresses du conteneur : celle du navigateur parmi elles → réseau de l'hôte, pas de pont. */
  ownAddresses: () => string[];
  /** Pile complète : le nom interne mène-t-il bien au réseau de la pile ? */
  checkSibling: (url: string) => Promise<void>;
}

async function resolvePrivate(name: string): Promise<string[]> {
  try {
    return (await lookup(name, { all: true })).map((entry) => entry.address);
  } catch {
    return [];
  }
}

const systemDeps: DiscoveryDeps = {
  udp: (unicast) => discoverByUdp({ unicast }),
  probe: (url) => probeJellyfin(url, PROBE_TIMEOUT_MS),
  gateway: () => {
    try {
      return parseDefaultGateway(readFileSync("/proc/net/route", "utf-8"));
    } catch {
      return null;
    }
  },
  dockerHostAddresses: async () => [...(await resolvePrivate("host.docker.internal")), ...(await resolvePrivate("host.containers.internal"))],
  ownAddresses: () => Object.values(networkInterfaces()).flatMap((entries) => (entries ?? []).map((entry) => entry.address)),
  checkSibling: (url) => assertStackSibling(url),
};

interface Target {
  url: string;
  source: DiscoverySource;
}

async function probeAll(targets: Target[], probe: DiscoveryDeps["probe"]): Promise<Array<ProbedJellyfin & { source: DiscoverySource }>> {
  const found: Array<ProbedJellyfin & { source: DiscoverySource }> = [];
  const queue = targets.slice(0, MAX_PROBES);
  const worker = async () => {
    for (let target = queue.shift(); target; target = queue.shift()) {
      try {
        found.push({ ...(await probe(target.url)), source: target.source });
      } catch {
        /* rien là, ou pas un Jellyfin */
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return found;
}

/** Un même serveur vu par deux chemins ne compte qu'une fois — le premier dans l'ordre des cibles l'emporte. */
function dedupe(found: Array<ProbedJellyfin & { source: DiscoverySource }>, order: string[]): Array<ProbedJellyfin & { source: DiscoverySource }> {
  const sorted = [...found].sort((a, b) => order.indexOf(a.url) - order.indexOf(b.url));
  const seen = new Set<string>();
  return sorted.filter((server) => (seen.has(server.id) ? false : (seen.add(server.id), true)));
}

export interface DiscoverInput {
  deployment: Deployment;
  browserHost: string | undefined;
  containerized: boolean;
}

export async function discoverJellyfins(input: DiscoverInput, deps: DiscoveryDeps = systemDeps): Promise<JellyfinDiscoveryResponse> {
  const { deployment, browserHost } = input;
  const toEntry = (server: ProbedJellyfin & { source: DiscoverySource }): DiscoveredJellyfin => ({
    url: server.url,
    version: server.version,
    serverName: server.serverName,
    blank: server.blank,
    compatible: server.compatible,
    source: server.source,
    clientUrl: clientJellyfinUrl({ deployment, browserHost, jellyfinUrl: server.url }),
  });

  if (deployment.siblingUrl) {
    await deps.checkSibling(deployment.siblingUrl);
    const sibling = await probeAll([{ url: deployment.siblingUrl, source: "stack" }], deps.probe);
    return { servers: sibling.map(toEntry), udp: "silent", bridged: false };
  }

  const native = deployment.deployment === "native";
  const hosts = candidateHosts({ browserHost, gateway: deps.gateway(), native, dockerHostAddresses: await deps.dockerHostAddresses() });
  const scanTargets: Target[] = hosts.flatMap((host) =>
    SCAN_PORTS.map((port) => ({ url: `${port === 8920 ? "https" : "http"}://${formatHost(host)}:${port}`, source: "scan" as const })),
  );
  const [udp, scanned] = await Promise.all([deps.udp(hosts.filter((host) => isIP(host) === 4)), probeAll(scanTargets, deps.probe)]);

  const scannedUrls = new Set(scanTargets.map((target) => target.url));
  const udpTargets: Target[] = udp.candidates
    .filter((candidate) => isScannableIp(candidate.host, native) || hosts.includes(candidate.host))
    .map((candidate) => ({ url: `${candidate.protocol}//${formatHost(candidate.host)}:${candidate.port}`, source: "udp" as const }))
    .filter((target) => !scannedUrls.has(target.url));
  const fromUdp = await probeAll(udpTargets, deps.probe);

  const order = [...scanTargets, ...udpTargets].map((target) => target.url);
  const servers = dedupe([...scanned, ...fromUdp], order)
    .sort((a, b) => Number(b.blank) - Number(a.blank) || Number(b.compatible) - Number(a.compatible))
    .map(toEntry);
  const browser = browserHost?.replace(/^\[(.*)\]$/, "$1") ?? "";
  const bridged = input.containerized && !deps.ownAddresses().includes(browser);
  return { servers, udp: udp.outcome, bridged };
}
