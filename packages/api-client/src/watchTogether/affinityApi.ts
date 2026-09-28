import type { WtAffinityKind, WtAffinityStateDto, WtAffinityVerdict } from "@tentacle-tv/shared";
import { WtApiError, wtFetch } from "../hooks/useWatchTogetherApi";
import type { SwipeCard } from "../swipe/swipeTypes";

/**
 * Watch Together — l'AFFINITÉ, le swipe de groupe (REST). Les gestes montent
 * ici ; l'état de la séance redescend à toute la salle par le socket
 * (`wt:affinity`). Les cartes ont la forme de la pile « Affiner » : les mêmes
 * composants les dessinent. La séance est un mode partagé : lancer, quitter,
 * répondre à un match vaut pour tout le groupe.
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

export interface AffinityKinds {
  /** Titres de chaque type que tout le groupe peut lire. */
  counts: Record<WtAffinityKind, number>;
  /** Les types dont une séance refermée attend : les lancer la reprend. */
  resume: WtAffinityKind[];
}

export async function fetchAffinityKinds(): Promise<AffinityKinds> {
  const body = await wtFetch<Partial<AffinityKinds> & Pick<AffinityKinds, "counts">>("/affinity/kinds");
  return { counts: body.counts, resume: body.resume ?? [] };
}

/** Lance la séance (elle s'ouvre chez tout le groupe), la reprend, ou change de type. */
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

/** Quitter l'affinité — à deux, elle se referme chez l'autre aussi. */
export async function leaveAffinity(): Promise<void> {
  await wtFetch<{ ok: true }>("/affinity/leave", { method: "POST", body: JSON.stringify({}) });
}

export async function fetchAffinityCards(sessionId: number, limit: number, exclude: readonly string[]): Promise<SwipeCard[]> {
  const params = new URLSearchParams({ sessionId: String(sessionId), limit: String(limit), exclude: exclude.join(",") });
  return (await wtFetch<{ cards: SwipeCard[] }>(`/affinity/cards?${params}`)).cards;
}

/** Un verdict ; rend s'il vient de faire un match, et l'état qui le porte. */
export function voteAffinity(
  sessionId: number,
  key: string,
  verdict: WtAffinityVerdict,
): Promise<{ matched: boolean; state: WtAffinityStateDto }> {
  return wtFetch<{ matched: boolean; state: WtAffinityStateDto }>("/affinity/votes", {
    method: "POST",
    body: JSON.stringify({ sessionId, key, verdict }),
  });
}

export async function undoAffinityVote(sessionId: number, key: string): Promise<void> {
  await wtFetch<{ ok: true }>(`/affinity/votes/${encodeURIComponent(key)}?sessionId=${sessionId}`, { method: "DELETE" });
}

/** « Continuer à swiper » : le match est écarté chez tous. Rend l'état. */
export async function dismissAffinityMatch(key: string): Promise<WtAffinityStateDto> {
  const body = await wtFetch<{ state: WtAffinityStateDto }>("/affinity/dismiss", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  return body.state;
}

/** « Regarder ensemble » : le match part en lecture, la séance se referme
 *  chez tous et ceux qui swipaient suivront. Échoue avec le code `answered`
 *  si quelqu'un a répondu avant. */
export async function launchAffinityMatch(key: string): Promise<void> {
  await wtFetch<{ ok: true }>("/affinity/launch", { method: "POST", body: JSON.stringify({ key }) });
}

/** La séance tenue par le client n'est plus celle du serveur (changement de
 *  type, séance arrêtée, serveur relancé) : relire l'état. */
export function isAffinityGone(err: unknown): boolean {
  return err instanceof WtApiError
    && ["stale_session", "no_session", "not_participant", "not_in_group"].includes(err.code ?? "");
}
