/**
 * Octave — ce que la boîte d'import comprend de ce qui est collé, AVANT
 * l'envoi (règle pure) : un lien reconnu (sa source, playlist ou album), un
 * lien inconnu, ou une liste de titres. Et l'avancée d'un import en une
 * fraction, pour la barre. Partagée : web large, web étroit et mobile.
 */

import { coreReadsImport, recognizeImportUrl, recognizeTentacleShare, type MusicImportSource } from "@tentacle-tv/shared/music";
import type { ImportFlowState, ImportUserInput } from "./importFlow";

export type PastedImport =
  | { kind: "empty" }
  | { kind: "url"; source: Exclude<MusicImportSource, "text">; album: boolean; readable: boolean; input: ImportUserInput }
  | { kind: "unknownUrl" }
  | { kind: "text"; lines: number; input: ImportUserInput };

const LINK = /^(?:https?:\/\/|spotify:)\S+$/i;

/**
 * `extensionSources` : ce que l'extension du compte lit en plus du cœur (YouTube…) ; `tentacleShare` : le
 * serveur lit un lien de partage d'un autre Tentacle (`music.playlistShare`).
 */
export function classifyPasted(raw: string, extensionSources: readonly MusicImportSource[], tentacleShare = false): PastedImport {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (!text.includes("\n") && LINK.test(text)) {
    const url = recognizeImportUrl(text);
    if (!url) return { kind: "unknownUrl" };
    const readable = coreReadsImport(url.source, tentacleShare) || (url.source !== "tentacle" && extensionSources.includes(url.source));
    return { kind: "url", source: url.source, album: url.kind === "album", readable, input: { kind: "url", url: text } };
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  return { kind: "text", lines, input: { kind: "text", text } };
}

/**
 * L'arrivée par la page d'un lien (`/octave/import?share=…`, `tentacle://octave/import?share=…`) : le lien à
 * coller dans la boîte d'import, ou `null` — lien non reconnu, ou pas le droit d'importer un lien (règle 15 :
 * rien ne s'ouvre).
 */
export function arrivingShareLink(raw: string | null | undefined, allowed: boolean): string | null {
  if (!allowed || !raw) return null;
  return recognizeTentacleShare(raw)?.url ?? null;
}

/** L'avancée en une fraction : lecture 10 %, bibliothèque jusqu'à 70 %, création 80 %, hors bibliothèque jusqu'au bout. */
export function importFraction(state: ImportFlowState, outsideExpected: boolean): number {
  const libraryEnd = outsideExpected ? 0.7 : 0.9;
  switch (state.phase) {
    case "reading":
      return 0.06;
    case "matching":
      return 0.1 + (state.total > 0 ? (state.matched / state.total) * (libraryEnd - 0.1) : 0);
    case "creating":
      return libraryEnd + 0.05;
    case "outside": {
      const o = state.outside;
      return 0.8 + (o && o.total > 0 ? (o.processed / o.total) * 0.2 : 0);
    }
    default:
      return 1;
  }
}
