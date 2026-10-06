import { docker, fetchWithin, sleep, waitFor } from "./stack";

/**
 * Un Jellyfin jetable, hors de toute pile : le « Jellyfin existant » des
 * scénarios. Son compte administrateur est créé par l'API de son propre
 * assistant (aucun clic dans son tableau de bord).
 */
const AUTH = 'MediaBrowser Client="tentacle-e2e", Device="e2e", DeviceId="tentacle-e2e-1", Version="1.0"';

export class DisposableJellyfin {
  constructor(
    readonly name: string,
    readonly port: number,
    readonly tag: string,
    readonly media: string,
  ) {}

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    await docker("rm", "-f", "-v", this.name).catch(() => undefined);
    await docker("run", "-d", "--name", this.name, "-p", `${this.port}:8096`, "-v", `${this.media}:/media`, `jellyfin/jellyfin:${this.tag}`);
    await waitFor(`Jellyfin ${this.tag}`, async () => {
      const info = (await (await fetchWithin(`${this.url}/System/Info/Public`)).json()) as { Id?: string };
      return info.Id ? info : null;
    }, 180_000);
  }

  /** Mène son propre assistant : le compte administrateur, puis « terminé ». */
  async completeStartup(username: string, password: string): Promise<void> {
    const post = (path: string, body?: unknown) =>
      fetchWithin(`${this.url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    await post("/Startup/Configuration", { UICulture: "fr-FR", MetadataCountryCode: "CH", PreferredMetadataLanguage: "fr" });
    await fetchWithin(`${this.url}/Startup/User`);
    await post("/Startup/User", { Name: username, Password: password });
    await post("/Startup/RemoteAccess", { EnableRemoteAccess: true, EnableAutomaticPortMapping: false });
    await post("/Startup/Complete");
  }

  token(username: string, password: string): Promise<string> {
    return jellyfinToken(this.url, username, password);
  }

  /** Les clés d'API du serveur (lues avec un jeton administrateur). */
  async keys(token: string): Promise<Array<{ AppName: string; AccessToken: string }>> {
    const res = await fetchWithin(`${this.url}/Auth/Keys`, { headers: { authorization: `${AUTH}, Token="${token}"` } });
    return ((await res.json()) as { Items: Array<{ AppName: string; AccessToken: string }> }).Items;
  }

  async stop(): Promise<void> {
    await docker("stop", this.name);
  }

  async resume(): Promise<void> {
    await docker("start", this.name);
    await sleep(1_000);
    await waitFor("Jellyfin de retour", async () => (await fetchWithin(`${this.url}/System/Info/Public`)).ok, 120_000);
  }

  async remove(): Promise<void> {
    if (process.env.E2E_KEEP === "1") return;
    await docker("rm", "-f", "-v", this.name).catch(() => undefined);
  }
}

/** Un jeton administrateur sur un Jellyfin quelconque (celui d'une pile complète, par exemple). */
export async function jellyfinToken(url: string, username: string, password: string): Promise<string> {
  const res = await fetchWithin(`${url}/Users/AuthenticateByName`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ Username: username, Pw: password }),
  });
  if (!res.ok) throw new Error(`Jellyfin refuse ${username} (${res.status})`);
  return ((await res.json()) as { AccessToken: string }).AccessToken;
}

export const authHeader = (token: string) => ({ authorization: `${AUTH}, Token="${token}"` });
