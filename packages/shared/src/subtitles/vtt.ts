/**
 * Parser WebVTT partagé (overlay sous-titres TV + mobile).
 *
 * Entrée : le fichier `…/Subtitles/{index}/Stream.vtt` complet renvoyé par
 * Jellyfin (conversion serveur SRT/ASS → WebVTT, balisage source fuité — cf.
 * tags.ts). Sortie : cues triées, texte structuré en segments stylés + ancrage
 * vertical résolu ({\anX} prioritaire sur le cue setting `line:NN%`, bas par
 * défaut). Les cues vides après nettoyage sont éliminées.
 */
import { tokenizeCueText } from "./tags";
import type { SubtitleAnchor, SubtitleSegment } from "./tags";

export * from "./tags";

export interface SubtitleCue {
  /** Secondes (timeline média absolue). */
  start: number;
  end: number;
  /** Lignes affichées, chacune découpée en segments de style homogène. */
  lines: SubtitleSegment[][];
  /** Ancrage vertical résolu ("bottom" par défaut). */
  anchor: SubtitleAnchor;
}

/** `HH:MM:SS.mmm` ou `MM:SS.mmm` ; tolère la virgule décimale (résidu SRT). */
function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + parseFloat(parts[2].replace(",", "."));
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + parseFloat(parts[1].replace(",", "."));
  }
  return NaN;
}

/** Cue settings après le timestamp de fin : seul `line:NN%` est interprété
 *  (position verticale de la boîte) ; les index de ligne signés, `align:`,
 *  `position:`… sont ignorés. */
function anchorFromSettings(settings: string): SubtitleAnchor | undefined {
  const m = settings.match(/(?:^|\s)line:(-?\d+(?:\.\d+)?)%/);
  if (!m) return undefined;
  const pct = parseFloat(m[1]);
  if (pct < 40) return "top";
  if (pct <= 60) return "middle";
  return undefined; // bas de l'écran = ancrage par défaut
}

/** Parse un fichier WebVTT complet en cues stylées, triées par début. */
export function parseVttCues(vtt: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = vtt.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const blockLines = block.split("\n").filter((l) => l.length > 0);
    if (blockLines.length === 0) continue;
    // Header et blocs non-cue — AVANT la recherche de "-->" (un NOTE peut en contenir).
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(blockLines[0])) continue;
    const timeLineIdx = blockLines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;
    const [startStr, endPart] = blockLines[timeLineIdx].split("-->");
    if (!endPart) continue;
    const endTokens = endPart.trim().split(/\s+/);
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endTokens[0]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const { lines, anchor } = tokenizeCueText(blockLines.slice(timeLineIdx + 1).join("\n"));
    if (lines.length === 0) continue;
    cues.push({
      start,
      end,
      lines,
      anchor: anchor ?? anchorFromSettings(endTokens.slice(1).join(" ")) ?? "bottom",
    });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}
