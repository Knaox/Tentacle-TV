import { jellyfinTokenAuth } from "../../services/jellyfinAuth";
import { SetupError } from "../setupErrors";
import type { SetupLocale } from "../setupWizardContract";
import { jellyfinRequest, type JellyfinReply } from "./guardedFetch";

/**
 * L'assistant de Jellyfin, fait par l'API — séquence relue dans le source de
 * Jellyfin 10.10.7, 10.11.11 et 12.1 (`StartupController`). Ses routes sont
 * ANONYMES tant que Jellyfin n'a pas fini son assistant
 * (`FirstTimeSetupOrElevated`) ; ensuite, elles exigent un administrateur :
 * un refus veut dire « ce Jellyfin n'est plus vierge ».
 */
export interface StartupAdmin {
  username: string;
  password: string;
}

export interface StartupOptions extends SetupLocale {
  serverName?: string;
}

/**
 * Les noms que Jellyfin accepte, en 10.10 comme en 12.1 (`ValidUsernameRegex`) :
 * lettres, chiffres, espace, `-`, `'`, `.`, `_`, `@` — sans blanc au bord, ni
 * `.` ni `..`. Le `+` n'est permis qu'à partir de 12.x : refusé ici.
 */
export const JELLYFIN_USERNAME = /^(?!\s)[\p{L}\p{Mn}\p{Nd}\p{Pc} \-'.@]+(?<!\s)$/u;

export function isValidJellyfinUsername(name: string): boolean {
  return name.length <= 64 && JELLYFIN_USERNAME.test(name) && name !== "." && name !== "..";
}

function expectDone(reply: JellyfinReply): void {
  if (reply.status === 401 || reply.status === 403) throw new SetupError("jf_not_blank");
  if (reply.status < 200 || reply.status >= 300) throw new SetupError("jf_startup_failed");
}

/** Jellyfin vierge : configuration, premier compte (administrateur), accès distant, fin de son assistant. */
export async function runJellyfinStartup(url: string, admin: StartupAdmin, options: StartupOptions): Promise<void> {
  const post = (path: string, body?: unknown) => jellyfinRequest(url, path, { method: "POST", body, timeoutMs: 20_000 });

  expectDone(
    await post("/Startup/Configuration", {
      UICulture: options.uiCulture,
      MetadataCountryCode: options.metadataCountry,
      PreferredMetadataLanguage: options.metadataLanguage,
      // Ignoré par 10.10, qui ne le connaît pas.
      ...(options.serverName ? { ServerName: options.serverName } : {}),
    }),
  );
  // Le GET crée le premier compte s'il n'existe pas encore : le POST le règle.
  expectDone(await jellyfinRequest(url, "/Startup/User", { timeoutMs: 20_000 }));
  expectDone(await post("/Startup/User", { Name: admin.username, Password: admin.password }));
  // Pas d'UPnP (10.10 et 10.11 l'exigent dans le corps ; 12.x l'ignore) : les
  // ports s'ouvrent à la main, guidés par l'assistant de Tentacle.
  expectDone(await post("/Startup/RemoteAccess", { EnableRemoteAccess: true, EnableAutomaticPortMapping: false }));
  expectDone(await post("/Startup/Complete"));
}

/** La fin de l'assistant de Jellyfin, par la clé — la reprise d'un verrouillage interrompu. */
export async function finishJellyfinStartup(url: string, apiKey: string): Promise<void> {
  const authorization = jellyfinTokenAuth(apiKey);
  const post = (path: string, body?: unknown) => jellyfinRequest(url, path, { method: "POST", body, authorization, timeoutMs: 20_000 });
  expectDone(await post("/Startup/RemoteAccess", { EnableRemoteAccess: true, EnableAutomaticPortMapping: false }));
  expectDone(await post("/Startup/Complete"));
}

/**
 * La langue et le pays choisis dans l'assistant de Tentacle, posés sur un
 * Jellyfin déjà configuré (le voisin verrouillé l'a été en anglais).
 */
export async function applyServerLocale(url: string, apiKey: string, options: StartupOptions): Promise<void> {
  const authorization = jellyfinTokenAuth(apiKey);
  const current = await jellyfinRequest(url, "/System/Configuration", { authorization, maxBytes: 1024 * 1024 });
  if (current.status !== 200 || !current.json || typeof current.json !== "object") throw new SetupError("jf_startup_failed");
  const updated = await jellyfinRequest(url, "/System/Configuration", {
    method: "POST",
    body: {
      ...(current.json as Record<string, unknown>),
      UICulture: options.uiCulture,
      MetadataCountryCode: options.metadataCountry,
      PreferredMetadataLanguage: options.metadataLanguage,
      ...(options.serverName ? { ServerName: options.serverName } : {}),
    },
    authorization,
  });
  if (updated.status < 200 || updated.status >= 300) throw new SetupError("jf_startup_failed");
}

/**
 * Le Jellyfin voisin a été verrouillé au démarrage par un administrateur
 * PROVISOIRE (cf. `siblingClaim.ts`) : il prend ici le nom et le mot de passe
 * choisis. Par la clé « Tentacle », qui est administratrice.
 */
export async function adoptProvisionalAdmin(url: string, apiKey: string, userId: string, admin: StartupAdmin): Promise<void> {
  const authorization = jellyfinTokenAuth(apiKey);
  const current = await jellyfinRequest(url, `/Users/${encodeURIComponent(userId)}`, { authorization });
  if (current.status !== 200 || !current.json || typeof current.json !== "object") throw new SetupError("jf_startup_failed");
  const user = current.json as Record<string, unknown>;

  if (user.Name !== admin.username) {
    // Le DTO complet revient tel quel : `UpdateUser` réécrit aussi la configuration.
    const renamed = await jellyfinRequest(url, "/Users", {
      method: "POST",
      query: { userId },
      body: { ...user, Name: admin.username },
      authorization,
    });
    if (renamed.status === 400) throw new SetupError("invalid_input");
    if (renamed.status < 200 || renamed.status >= 300) throw new SetupError("jf_startup_failed");
  }

  const password = await jellyfinRequest(url, "/Users/Password", {
    method: "POST",
    query: { userId },
    body: { NewPw: admin.password, ResetPassword: false },
    authorization,
  });
  if (password.status < 200 || password.status >= 300) throw new SetupError("jf_startup_failed");
}
