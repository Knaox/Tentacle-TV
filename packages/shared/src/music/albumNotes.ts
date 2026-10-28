/**
 * Octave — les notes d'un album : sa description Jellyfin (`MusicAlbum.description`), rendue au pied de la page album
 * sur TOUTES les plateformes (bureau, web étroit, mobile). C'est là que vivent les mentions qu'une licence exige
 * (« Contenu libre de droit », auteur, source, licence) : elles se lisent en entier, et leurs adresses s'ouvrent.
 * Pur : les vues ne font que dessiner les lignes ; une adresse ne s'ouvre que si elle est en http(s).
 */

import type { MusicAlbum } from "./musicTypes";

export type AlbumNoteSegment = { kind: "text"; text: string } | { kind: "link"; text: string; url: string };

/** Une ligne de la description, découpée en texte et liens. */
export type AlbumNoteLine = readonly AlbumNoteSegment[];

const URL_PATTERN = /https?:\/\/[^\s<>"«»]+/g;
/** Ponctuation qui termine une phrase, jamais une adresse. */
const TRAILING = /[.,;:!?)\]]+$/;

function segmentsOf(line: string): AlbumNoteSegment[] {
  const out: AlbumNoteSegment[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const url = raw.replace(TRAILING, "");
    const start = match.index ?? 0;
    if (start > last) out.push({ kind: "text", text: line.slice(last, start) });
    out.push({ kind: "link", text: url, url });
    last = start + url.length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

/** Les lignes de la description (lignes vides retirées) ; `[]` : rien à montrer. */
export function albumNotesOf(album: Pick<MusicAlbum, "description"> | null | undefined): AlbumNoteLine[] {
  const text = album?.description?.trim();
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(segmentsOf);
}
