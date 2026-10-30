/**
 * Octave — l'historique de la recherche que TENTACLE garde par compte (`music_search_history`, contrat
 * `musicSearchHistory.ts`). Au plus `MUSIC_SEARCH_HISTORY_MAX` lignes de chaque sorte : chaque ajout réécrit
 * l'historique du compte (quarante lignes au plus) dans une transaction, d'après la règle pure du contrat.
 */

import { getPrisma } from "../../services/db";
import {
  EMPTY_SEARCH_HISTORY, forgetInSearchHistory, isSearchTrackSnapshot, mergeSearchHistory, normalizeSearchQuery, searchQueryKey,
  type MusicSearchHistory, type MusicSearchHistoryAdd, type MusicSearchHistoryForget,
} from "../contract/musicSearchHistory";

const account = (userId: string) => userId.replace(/-/g, "").toLowerCase();

function parsePayload(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

export async function readSearchHistory(userId: string): Promise<MusicSearchHistory> {
  const rows = await getPrisma().musicSearchHistory.findMany({ where: { userId: account(userId) }, orderBy: { at: "desc" } });
  const history: MusicSearchHistory = { queries: [], tracks: [] };
  for (const row of rows) {
    const payload = parsePayload(row.payloadJson);
    const at = row.at.getTime();
    if (row.kind === "query") {
      const text = normalizeSearchQuery((payload as { text?: unknown } | null)?.text);
      if (text !== null) history.queries.push({ text, at });
    } else if (row.kind === "track" && isSearchTrackSnapshot(payload)) {
      history.tracks.push({ track: payload, at });
    }
  }
  // Relu par la même règle : une ligne en double ou en trop (écriture concurrente) ne se montre pas.
  return mergeSearchHistory(EMPTY_SEARCH_HISTORY, history);
}

async function writeSearchHistory(userId: string, history: MusicSearchHistory): Promise<void> {
  const id = account(userId);
  const rows = [
    ...history.queries.map((e) => ({ userId: id, kind: "query", itemKey: searchQueryKey(e.text), payloadJson: JSON.stringify({ text: e.text }), at: new Date(e.at) })),
    ...history.tracks.map((e) => ({ userId: id, kind: "track", itemKey: e.track.key, payloadJson: JSON.stringify(e.track), at: new Date(e.at) })),
  ];
  const prisma = getPrisma();
  await prisma.$transaction([prisma.musicSearchHistory.deleteMany({ where: { userId: id } }), prisma.musicSearchHistory.createMany({ data: rows })]);
}

export async function addToSearchHistory(userId: string, add: MusicSearchHistoryAdd): Promise<MusicSearchHistory> {
  const next = mergeSearchHistory(await readSearchHistory(userId), add);
  await writeSearchHistory(userId, next);
  return next;
}

export async function forgetSearchHistory(userId: string, forget: MusicSearchHistoryForget): Promise<MusicSearchHistory> {
  if (forget.kind === "all") {
    await getPrisma().musicSearchHistory.deleteMany({ where: { userId: account(userId) } });
    return EMPTY_SEARCH_HISTORY;
  }
  const next = forgetInSearchHistory(await readSearchHistory(userId), forget);
  await writeSearchHistory(userId, next);
  return next;
}
