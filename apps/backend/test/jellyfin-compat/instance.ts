/**
 * Une instance Jellyfin jetable, de l'image officielle jusqu'aux titres
 * scannés : médiathèque synthétique, conteneur, assistant, clé d'API,
 * autorisation héritée réglée, bibliothèques, comptes, scan, identifiants.
 */

import { writeFileSync } from "node:fs";
import {
  containerState, docker, ensureImage, removeContainer, removeVolume, runInJellyfinImage, startJellyfin,
} from "./docker";
import { libraryReady, resolveFixtures, scanLibrary, type Fixtures } from "./fixtures";
import { JellyfinHttp } from "./jellyfinHttp";
import { mediaScript } from "./media";
import {
  ADMIN_NAME, USER2_NAME, USER_NAME, allowShortResume, authenticate, completeWizard, ensureApiKey, ensureLibraries, ensureUser, libraryIds,
  setLegacyAuthorization, waitForServer, type Account, type Library,
} from "./provision";

export interface InstanceOptions {
  image: string;
  prefix: string;
  /** Le tag Docker demandé (« 12.1 »), qui nomme le conteneur. */
  tag: string;
  port: number;
  /** Repartir d'une instance déjà préparée plutôt que d'une neuve. */
  reuse: boolean;
  /** `off` : coupée (défaut, comme 12.x) ; `on` : allumée ; `default` : ce que fait la version. */
  legacyAuth: "off" | "on" | "default";
  openapiFile: string;
}

export interface PreparedInstance {
  url: string;
  version: string;
  serverId: string;
  container: string;
  legacyAuth: boolean | null;
  apiKey: string;
  admin: Account;
  libraries: Library[];
  fixtures: Fixtures;
  userIds: { user: string; user2: string };
}

export function containerName(prefix: string, tag: string): string {
  return `${prefix}-jf-${tag}`;
}

export async function prepareInstance(opts: InstanceOptions, log: (l: string) => void): Promise<PreparedInstance> {
  ensureImage(opts.image, log);
  const media = `${opts.prefix}-media`;
  docker(["volume", "create", "--label", "tentacle.jellyfin-compat=1", media]);
  log("Médiathèque synthétique (ffmpeg de l'image Jellyfin)…");
  log(`  ${runInJellyfinImage(opts.image, media, mediaScript()).stdout.trim().split("\n").pop()}`);

  const container = containerName(opts.prefix, opts.tag);
  if (!opts.reuse) {
    removeContainer(container);
    removeVolume(`${container}-config`);
    removeVolume(`${container}-cache`);
  }
  if (containerState(container) === "stopped") docker(["start", container]);
  if (containerState(container) === "missing") {
    log(`Démarrage de ${opts.image} (${container}, port ${opts.port})…`);
    startJellyfin({ name: container, image: opts.image, port: opts.port, configVolume: `${container}-config`, cacheVolume: `${container}-cache`, mediaVolume: media });
  }

  const url = `http://127.0.0.1:${opts.port}`;
  const http = new JellyfinHttp(url);
  const info = await waitForServer(http);
  log(`Jellyfin ${info.Version} répond.`);
  await completeWizard(http);
  const admin = await authenticate(http, ADMIN_NAME);
  const apiKey = await ensureApiKey(http, admin.token);
  const legacyAuth = opts.legacyAuth === "default" ? await legacyState(http, admin.token) : await setLegacyAuthorization(http, admin.token, opts.legacyAuth === "on");
  log(`Autorisation héritée : ${legacyAuth === null ? "sans option (toujours acceptée)" : legacyAuth ? "acceptée" : "COUPÉE"}`);
  await allowShortResume(http, admin.token);
  await ensureLibraries(http, admin.token);
  const userIds = { user: await ensureUser(http, admin.token, USER_NAME), user2: await ensureUser(http, admin.token, USER2_NAME) };
  const counts = (opts.reuse ? await libraryReady(http, admin.token) : null) ?? await scanLibrary(http, admin.token, log);
  log(`Indexés : ${counts.MovieCount} films, ${counts.SeriesCount} séries, ${counts.EpisodeCount} épisodes.`);
  const libraries = await libraryIds(http, admin.token);
  const fixtures = await resolveFixtures(http, admin.token, admin.id);

  const openapi = await fetch(`${url}/api-docs/openapi.json`);
  if (!openapi.ok) throw new Error(`OpenAPI indisponible (${openapi.status})`);
  writeFileSync(opts.openapiFile, await openapi.text());

  return { url, version: info.Version, serverId: info.Id, container, legacyAuth, apiKey, admin, libraries, fixtures, userIds };
}

async function legacyState(http: JellyfinHttp, token: string): Promise<boolean | null> {
  const config = await http.get<Record<string, unknown>>("/System/Configuration", token);
  return "EnableLegacyAuthorization" in config ? config.EnableLegacyAuthorization === true : null;
}

export function removeInstance(prefix: string, tag: string): void {
  const container = containerName(prefix, tag);
  removeContainer(container);
  removeVolume(`${container}-config`);
  removeVolume(`${container}-cache`);
}
