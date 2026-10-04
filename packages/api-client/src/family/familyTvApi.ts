import {
  familyPath,
  type ManageUnlockBody,
  type ManageUnlockResponse,
  type OpenTvSessionBody,
  type TvEnrollResponse,
  type TvProfilesDto,
  type TvSessionDto,
} from "@tentacle-tv/shared";
import { TentacleApiError } from "../hooks/usePreferences";

/**
 * La Famille sur l'Apple TV — les appels qui portent un jeton EXPLICITE :
 *
 * - le jeton d'appareil d'avant les profils, échangé UNE fois (`enrollTvProfiles`) ;
 * - le jeton de JUMELAGE qui en résulte : il ne sert qu'à lister les profils
 *   (`fetchTvProfiles`), à en ouvrir un (`openTvProfileSession`) et à se
 *   déjumeler (`endTvToken`) — partout ailleurs, le serveur le refuse ;
 * - le jeton de la SESSION DE PROFIL : la session de l'application, comme un
 *   jumelage d'avant ; `unlockTvManage` ouvre « Gérer les profils » (profil du
 *   propriétaire) et `endTvToken` la ferme (« Changer de profil »).
 *
 * Un refus porte son code : `familyErrorFromApi` (`familyApi.ts`) le lit.
 * Contrat et mécanisme : docs/FAMILLE.md.
 */

export interface TvFamilyCall {
  /** L'adresse du serveur Tentacle de la TV, sans `/` final. */
  serverUrl: string;
  token: string;
  signal?: AbortSignal;
}

async function tvCall<T>(call: TvFamilyCall, path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${call.token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${call.serverUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      signal: call.signal,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new TentacleApiError(error instanceof Error ? error.message : "network", 0);
  }
  if (!res.ok) throw new TentacleApiError(await res.text().catch(() => `${res.status}`), res.status);
  return res.json() as Promise<T>;
}

/** L'échange : le jeton d'avant (ou un jeton de jumelage déjà échangé, rendu
 *  tel quel) contre le jeton de jumelage « profils seuls ». À GARDER aussitôt :
 *  l'ancien ne vaut plus rien ailleurs. */
export function enrollTvProfiles(call: TvFamilyCall): Promise<TvEnrollResponse> {
  return tvCall(call, familyPath("tvEnroll"), "POST");
}

/** « Qui regarde ? » — avec le jeton de jumelage. */
export function fetchTvProfiles(call: TvFamilyCall): Promise<TvProfilesDto> {
  return tvCall(call, familyPath("tvProfiles"), "GET");
}

/** Ouvre la session d'un profil (PIN vérifié par le serveur) — avec le jeton de
 *  jumelage. La session précédente de cette TV est fermée. */
export function openTvProfileSession(call: TvFamilyCall, body: OpenTvSessionBody): Promise<TvSessionDto> {
  return tvCall(call, familyPath("tvOpenSession"), "POST", body);
}

/** « Gérer les profils » — avec le jeton de la session du PROPRIÉTAIRE. */
export function unlockTvManage(call: TvFamilyCall, body: ManageUnlockBody = {}): Promise<ManageUnlockResponse> {
  return tvCall(call, familyPath("tvManageUnlock"), "POST", body);
}

/** Révoque le jeton présenté : une session de profil se ferme (« Changer de
 *  profil ») ; le jeton de jumelage déjumelle la TV, ses sessions avec. */
export function endTvToken(call: TvFamilyCall): Promise<{ revoked: true }> {
  return tvCall(call, "/api/pair/self/revoke", "POST");
}
