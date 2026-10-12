/**
 * `jellyfin.detect` : le Jellyfin de CETTE machine, en trois temps — le
 * registre de l'installateur officiel, puis `network.xml` (port, BaseUrl),
 * puis `/System/Info/Public`, qui doit rendre un `Id` (le serveur d'attente
 * de Jellyfin 10.11 rend un 200 sans `Id` pendant son démarrage).
 *
 * Tout passe par des dépendances injectées : la règle se teste partout, sans
 * registre ni Jellyfin.
 */
import { request as httpRequest } from "node:http";
import type { JellyfinInstallerOffer, JellyfinLocalDetection } from "../protocol";
import {
  DEFAULT_JELLYFIN_PORT, JELLYFIN_PROCESS, JELLYFIN_SERVICE, networkXmlCandidates, parseNetworkXml, readJellyfinRegistry, trayLauncher,
  type NetworkSettings,
} from "./jellyfinFiles";
import { parseServiceState, processListed, type ToolRunner } from "./systemTools";

export interface DetectDeps {
  run: ToolRunner;
  env: { ProgramData?: string; LOCALAPPDATA?: string };
  readText: (path: string) => string | null;
  exists: (path: string) => boolean;
  /** `GET <url>/System/Info/Public` → la version si la réponse porte un `Id`, sinon `null`. */
  probe: (url: string) => Promise<{ version: string | null } | null>;
  installer: () => { offer: JellyfinInstallerOffer; installing: boolean };
}

function readNetwork(deps: DetectDeps, dataFolder: string | null): NetworkSettings {
  for (const path of networkXmlCandidates(dataFolder, deps.env)) {
    const xml = deps.readText(path);
    if (xml !== null) return parseNetworkXml(xml);
  }
  return { port: null, baseUrl: "" };
}

export async function detectJellyfin(deps: DetectDeps): Promise<JellyfinLocalDetection> {
  const registry = await readJellyfinRegistry(deps.run);
  const network = readNetwork(deps, registry?.dataFolder ?? null);
  const port = network.port ?? DEFAULT_JELLYFIN_PORT;
  const url = `http://127.0.0.1:${port}${network.baseUrl}`;
  const [answer, service, processes] = await Promise.all([
    deps.probe(url),
    deps.run("sc", ["query", JELLYFIN_SERVICE]).then(parseServiceState),
    deps.run("tasklist", ["/FI", `IMAGENAME eq ${JELLYFIN_PROCESS}`, "/FO", "CSV", "/NH"]),
  ]);
  // Le service existe : c'est lui qui fait foi, quoi que dise le registre.
  const mode = service !== "absent" ? "service" : (registry?.mode ?? null);
  const installed = registry !== null || service !== "absent" || processListed(processes.stdout, JELLYFIN_PROCESS);
  const state = answer ? "running" : installed ? "stopped" : "absent";
  const launcher = registry?.installFolder ? trayLauncher(registry.installFolder) : null;
  const { offer, installing } = deps.installer();
  return {
    state,
    mode,
    version: answer?.version ?? registry?.version ?? null,
    url,
    port,
    // Pas un service, et le lanceur est là : même sans `ServiceAccountType` lisible, on sait le démarrer.
    canStart: state === "stopped" && mode !== "service" && launcher !== null && deps.exists(launcher),
    installer: offer,
    installing,
  };
}

const PROBE_TIMEOUT_MS = 3_000;
const PROBE_MAX_BYTES = 64 * 1024;

/** La sonde réelle : une réponse sans `Id` n'est pas (encore) Jellyfin. */
export function probeJellyfin(url: string): Promise<{ version: string | null } | null> {
  return new Promise((resolve) => {
    const req = httpRequest(`${url}/System/Info/Public`, { timeout: PROBE_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
        if (body.length > PROBE_MAX_BYTES) req.destroy();
      });
      res.on("end", () => {
        try {
          const info = JSON.parse(body) as { Id?: unknown; Version?: unknown };
          resolve(typeof info.Id === "string" && info.Id !== "" ? { version: typeof info.Version === "string" ? info.Version : null } : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => req.destroy());
    req.end();
  });
}
