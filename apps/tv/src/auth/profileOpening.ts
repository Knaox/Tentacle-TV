import { fetchTvProfiles, openTvProfileSession, TentacleApiError } from "@tentacle-tv/api-client";
import type { TvProfilesDto } from "@tentacle-tv/shared";
import {
  PROFILE_STORAGE_KEYS,
  TV_PAIRING_TOKEN_KEY,
  cacheProfiles,
  profileRefusalOf,
  rememberProfiles,
  scrubCountdownKey,
  wipeAccount,
  type ProfileLaunch,
  type ProfileRefusal,
} from "@tentacle-tv/tv-core";
import { adoptProfileSession } from "./profileSession";
import type { UnpairContext } from "./unpair";

/**
 * « Qui regarde ? » côté réseau : lire les profils de la TV et en ouvrir un,
 * avec le jeton de JUMELAGE — le seul usage qu'en fait la TV (avec le
 * déjumelage). Le PIN ne fait que transiter : il part dans le corps de
 * l'appel (jamais dans une URL), le serveur seul le juge, et rien ne le garde.
 */

export interface ProfilesCall {
  serverUrl: string;
  token: string;
}

/** L'adresse et le jeton de jumelage ; null hors d'une TV passée aux profils. */
export function pairingCall(storage: UnpairContext["storage"]): ProfilesCall | null {
  const serverUrl = storage.getItem("tentacle_server_url");
  const token = storage.getItem(TV_PAIRING_TOKEN_KEY);
  return serverUrl && token ? { serverUrl, token } : null;
}

/** Le refus d'un appel de la Famille, lu par tv-core (`profileRefusalOf`) ; sans réponse : hors ligne. */
export function refusalOfError(error: unknown): ProfileRefusal {
  if (error instanceof TentacleApiError) return profileRefusalOf(error.status, error.message);
  return { kind: "offline" };
}

export type ProfilesLoad = { ok: true; listing: TvProfilesDto } | { ok: false; refusal: ProfileRefusal };

/**
 * Les profils de la TV. Au passage, ce que la TV range par profil (l'avance
 * rapide) s'efface pour ceux qui ont quitté la famille, et la liste se garde :
 * au prochain lancement, « Qui regarde ? » paraît sans attendre.
 */
export async function loadProfiles({ storage }: Pick<UnpairContext, "storage">, signal?: AbortSignal): Promise<ProfilesLoad> {
  const call = pairingCall(storage);
  if (!call) return { ok: false, refusal: { kind: "unpaired" } };
  try {
    const listing = await fetchTvProfiles({ ...call, signal });
    cacheProfiles(storage, listing);
    for (const gone of rememberProfiles(storage, listing.profiles.map((profile) => profile.userId))) {
      storage.removeItem(scrubCountdownKey(gone));
    }
    return { ok: true, listing };
  } catch (error) {
    return { ok: false, refusal: refusalOfError(error) };
  }
}

export interface OpenRequest {
  profileId: string;
  pin?: string;
  remember: boolean;
  launch: ProfileLaunch;
}

export type OpenResult = { ok: true } | { ok: false; refusal: ProfileRefusal };

/**
 * Ouvre la session d'un profil et l'adopte. Une session d'un AUTRE compte que
 * celui dont la TV garde encore des traces (le jumelage d'avant l'échange)
 * repart d'une page blanche : rien d'un compte ne paraît dans un autre.
 */
export async function openProfile(context: UnpairContext, listing: TvProfilesDto, request: OpenRequest): Promise<OpenResult> {
  const call = pairingCall(context.storage);
  if (!call) return { ok: false, refusal: { kind: "unpaired" } };
  try {
    const session = await openTvProfileSession(call, {
      profileId: request.profileId,
      ...(request.pin ? { pin: request.pin } : {}),
      remember: request.remember,
    });
    if (residualUserId(context.storage) !== session.user.id) {
      context.queryClient.clear();
      wipeAccount(context.storage, PROFILE_STORAGE_KEYS);
    }
    adoptProfileSession(context, session, listing, request.launch);
    return { ok: true };
  } catch (error) {
    return { ok: false, refusal: refusalOfError(error) };
  }
}

/** Le compte dont la TV garde encore des données (cache, file des rapports), ou null. */
function residualUserId(storage: UnpairContext["storage"]): string | null {
  try {
    const user = JSON.parse(storage.getItem("tentacle_user") ?? "null") as { Id?: unknown } | null;
    return typeof user?.Id === "string" ? user.Id : null;
  } catch {
    return null;
  }
}
