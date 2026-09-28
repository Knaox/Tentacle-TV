import type { WtAffinityKind, WtAffinityStateDto, WtAffinityVerdict } from "@tentacle-tv/shared";
import { WtApiError, wtFetch } from "../hooks/useWatchTogetherApi";
import type { SwipeCard } from "../swipe/swipeTypes";

/**
 * Watch Together — l'AFFINITÉ, le swipe de groupe (REST). Les gestes montent
 * ici ; l'état de la séance redescend à toute la salle par le socket
 * (`wt:affinity`). Les cartes ont la forme de la pile « Affiner » : les mêmes
 * composants les dessinent.
 */

export interface AffinityJoinResponse {
  state: WtAffinityStateDto;
  sessionId: number;
  cards: SwipeCard[];
}

/** La séance de ma salle, ou null. Un serveur d'avant l'affinité répond 404 :
 *  pas de séance, et pas d'erreur à montrer. */
export async function fetchAffinity(): Promise<WtAffinityStateDto | null> {
  try {
    return (await wtFetch<{ state: WtAffinityStateDto | null }>("/affinity")).state;
  } catch (err) {
    if (err instanceof WtApiError && err.status === 404) return null;
    throw err;
  }
}

/** Titres de chaque type que tout le groupe peut lire. */
export async function fetchAffinityKinds(): Promise<Record<WtAffinityKind, number>> {
  return (await wtFetch<{ counts: Record<WtAffinityKind, number> }>("/affinity/kinds")).counts;
}

/** Lance la séance, ou change de type. */
export async function startAffinity(kind: WtAffinityKind): Promise<WtAffinityStateDto> {
  const body = await wtFetch<{ state: WtAffinityStateDto }>("/affinity", {
    method: "POST",
    body: JSON.stringify({ kind }),
  });
  return body.state;
}

export function joinAffinity(limit: number): Promise<AffinityJoinResponse> {
  return wtFetch<AffinityJoinResponse>("/affinity/join", { method: "POST", body: JSON.stringify({ limit }) });
}

export async function leaveAffinity(): Promise<void> {
  await wtFetch<{ ok: true }>("/affinity/leave", { method: "POST", body: JSON.stringify({}) });
}

export async function fetchAffinityCards(sessionId: number, limit: number, exclude: readonly string[]): Promise<SwipeCard[]> {
  const params = new URLSearchParams({ sessionId: String(sessionId), limit: String(limit), exclude: exclude.join(",") });
  return (await wtFetch<{ cards: SwipeCard[] }>(`/affinity/cards?${params}`)).cards;
}

export function voteAffinity(sessionId: number, key: string, verdict: WtAffinityVerdict): Promise<{ matched: boolean }> {
  return wtFetch<{ matched: boolean }>("/affinity/votes", {
    method: "POST",
    body: JSON.stringify({ sessionId, key, verdict }),
  });
}

export async function undoAffinityVote(sessionId: number, key: string): Promise<void> {
  await wtFetch<{ ok: true }>(`/affinity/votes/${encodeURIComponent(key)}?sessionId=${sessionId}`, { method: "DELETE" });
}

/** Un match part en lecture : ceux qui swipaient suivront. */
export async function launchAffinityMatch(key: string): Promise<void> {
  await wtFetch<{ ok: true }>("/affinity/launch", { method: "POST", body: JSON.stringify({ key }) });
}

/** La séance tenue par le client n'est plus celle du serveur (changement de
 *  type, séance arrêtée, serveur relancé) : relire l'état. */
export function isAffinityGone(err: unknown): boolean {
  return err instanceof WtApiError
    && ["stale_session", "no_session", "not_participant", "not_in_group"].includes(err.code ?? "");
}
