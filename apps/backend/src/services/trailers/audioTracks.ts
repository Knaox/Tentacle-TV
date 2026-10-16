/* ------------------------------------------------------------------ */
/*  Les pistes audio d'une vidéo YouTube : l'originale, les doublages  */
/*                                                                     */
/*  Une vidéo YouTube peut porter plusieurs pistes : l'ORIGINALE, des  */
/*  doublages faits par des humains, et des doublages AUTOMATIQUES     */
/*  (voix de synthèse, traduction par IA). YouTube les marque dans ses */
/*  « xtags » : `acont=original|dubbed|dubbed-auto|descriptive`, plus   */
/*  `lang`. Relevé le 2026-10-16 (yt-dlp 2026.08.19, client visionos) :*/
/*   - maître HLS : `YT-EXT-XTAGS` sur chaque `#EXT-X-MEDIA` audio      */
/*     (protobuf en base64 : des paires clé/valeur), un NAME qui finit  */
/*     par « - dubbed-auto », la même chose encodée dans l'URI ;        */
/*   - formats https : `xtags=acont%3Ddubbed-auto%3Alang%3Dfr-FR` dans  */
/*     l'URL.                                                          */
/*  Toutes les pistes y sont `AUTOSELECT=YES` : AVPlayer, ExoPlayer,   */
/*  mpv ou hls.js prennent celle de la langue de l'APPAREIL — le       */
/*  doublage par IA sur un téléviseur réglé en français.               */
/*                                                                     */
/*  La règle : un doublage automatique n'est JAMAIS joué. On garde un  */
/*  doublage humain dans la langue du serveur (une vraie VF), sinon    */
/*  l'originale — quitte à jouer de la VO. Module pur.                 */
/* ------------------------------------------------------------------ */

import type { TrailerAudio } from "../../trailers/trailerCatalog";

/** Le contenu d'une piste, d'après YouTube ; `unknown` : rien ne le dit. */
export type AudioContent = "original" | "dubbed" | "dubbed-auto" | "descriptive" | "unknown";

export interface AudioTag {
  content: AudioContent;
  /** La langue de la piste (`fr-FR`, `en`), si quelque chose la dit. */
  lang?: string;
}

/** Ce qu'une extraction dit des pistes de la vidéo : `undefined` si elle n'en a qu'une. */
export interface AudioInventory {
  /** La langue de l'originale, si YouTube la marque. */
  original?: string;
  /** Les doublages humains (langues). */
  dubbed: string[];
  /** Les doublages automatiques (langues) : jamais joués. */
  autoDubbed: string[];
}

/** La piste à jouer : son contenu et sa langue (le contrat du catalogue la rend aux clients). */
export type AudioChoice = TrailerAudio;

const CONTENTS: readonly AudioContent[] = ["original", "dubbed", "dubbed-auto", "descriptive"];

/** La langue principale (`fr-FR` → `fr`). */
export const primaryLang = (lang: string | null | undefined) => (lang ?? "").split("-")[0].toLowerCase();

function contentOf(value: string | undefined): AudioContent {
  const v = (value ?? "").toLowerCase();
  return (CONTENTS as readonly string[]).includes(v) ? (v as AudioContent) : v.startsWith("dubbed-auto") ? "dubbed-auto" : "unknown";
}

/** Lit un varint protobuf à `at` ; `null` s'il déborde. */
function varint(bytes: Uint8Array, at: number): [number, number] | null {
  let value = 0;
  for (let shift = 0, i = at; i < bytes.length && shift < 28; i++, shift += 7) {
    value |= (bytes[i] & 0x7f) << shift;
    if (!(bytes[i] & 0x80)) return [value, i + 1];
  }
  return null;
}

/** Les champs « chaîne » (type 2) d'un message protobuf, dans l'ordre : [numéro, octets]. */
function fields(bytes: Uint8Array): Array<[number, Uint8Array]> {
  const out: Array<[number, Uint8Array]> = [];
  let at = 0;
  while (at < bytes.length) {
    const key = varint(bytes, at);
    if (!key || (key[0] & 7) !== 2) return out;
    const length = varint(bytes, key[1]);
    if (!length || length[1] + length[0] > bytes.length) return out;
    out.push([key[0] >> 3, bytes.subarray(length[1], length[1] + length[0])]);
    at = length[1] + length[0];
  }
  return out;
}

/** `YT-EXT-XTAGS` (protobuf base64 : paires `{1: clé, 2: valeur}`) → `{ acont, lang }`. Illisible : `{}`. */
export function decodeXtags(base64: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = (b: Uint8Array) => Buffer.from(b).toString("utf8");
  for (const [number, pair] of fields(Buffer.from(base64.replace(/-/g, "+").replace(/_/g, "/"), "base64"))) {
    if (number !== 1) continue;
    const parts = new Map(fields(pair));
    const key = parts.get(1);
    const value = parts.get(2);
    if (key && value) out[text(key)] = text(value);
  }
  return out;
}

/** Les xtags écrits en clair dans une URL (`xtags=acont%3Ddubbed-auto%3Alang%3Dfr-FR`, ou `xtags%3D…` dans un chemin). */
export function urlXtags(url: string): Record<string, string> {
  const raw = /xtags(?:=|%3D)([^&/]*)/i.exec(url)?.[1];
  if (!raw) return {};
  let text = raw;
  for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(text); i++) {
    try { text = decodeURIComponent(text); } catch { break; }
  }
  const out: Record<string, string> = {};
  for (const part of text.split(/[:;]/)) {
    const [key, value] = part.split("=");
    if (key && value) out[key.trim()] = value.trim();
  }
  return out;
}

/** Ce qu'une piste dit d'elle : les xtags d'abord, puis l'URL, puis le NAME (« … - dubbed-auto »). */
export function audioTagOf(attrs: { xtags?: string; uri?: string; name?: string; language?: string }): AudioTag {
  const tags = { ...(attrs.uri ? urlXtags(attrs.uri) : {}), ...(attrs.xtags ? decodeXtags(attrs.xtags) : {}) };
  let content = contentOf(tags.acont);
  if (content === "unknown" && /dubbed-auto|auto-dubbed/i.test(attrs.name ?? "")) content = "dubbed-auto";
  const lang = tags.lang || attrs.language || undefined;
  return lang ? { content, lang } : { content };
}

/** Une piste qu'aucun lecteur ne doit jouer : doublage automatique, ou audiodescription. */
export const isUnplayableAudio = (tag: AudioTag) => tag.content === "dubbed-auto" || tag.content === "descriptive";

/** L'inventaire des pistes d'après les URL des formats d'une extraction ; `undefined` si rien n'est marqué. */
export function audioInventory(urls: readonly string[]): AudioInventory | undefined {
  const inventory: AudioInventory = { dubbed: [], autoDubbed: [] };
  let marked = false;
  for (const url of urls) {
    const tag = audioTagOf({ uri: url });
    if (!tag.lang || tag.content === "unknown") continue;
    marked = true;
    if (tag.content === "original") inventory.original ??= tag.lang;
    else if (tag.content === "dubbed" && !inventory.dubbed.includes(tag.lang)) inventory.dubbed.push(tag.lang);
    else if (tag.content === "dubbed-auto" && !inventory.autoDubbed.includes(tag.lang)) inventory.autoDubbed.push(tag.lang);
  }
  return marked ? inventory : undefined;
}

/**
 * La piste à jouer parmi celles qu'on connaît : un doublage HUMAIN dans la
 * langue du serveur, sinon l'originale. `null` : aucune piste marquée
 * jouable (rien à choisir — la vidéo n'a qu'une piste, ou YouTube ne dit
 * rien). Jamais un doublage automatique.
 */
export function chooseAudio(tags: readonly AudioTag[], serverLang: string | null | undefined): AudioChoice | null {
  const wanted = primaryLang(serverLang);
  const human = wanted ? tags.find((t) => t.content === "dubbed" && t.lang && primaryLang(t.lang) === wanted) : undefined;
  if (human?.lang) return { content: "dubbed", lang: human.lang };
  const original = tags.find((t) => t.content === "original" && t.lang);
  return original?.lang ? { content: "original", lang: original.lang } : null;
}

/** Les pistes d'un inventaire, pour `chooseAudio`. */
export function inventoryTags(inventory: AudioInventory | undefined): AudioTag[] {
  if (!inventory) return [];
  return [
    ...(inventory.original ? [{ content: "original" as const, lang: inventory.original }] : []),
    ...inventory.dubbed.map((lang) => ({ content: "dubbed" as const, lang })),
    ...inventory.autoDubbed.map((lang) => ({ content: "dubbed-auto" as const, lang })),
  ];
}

/**
 * Complète une piste que le maître ne marque que par sa langue (variante
 * muxée, `YT-EXT-AUDIO-CONTENT-ID`) d'après l'inventaire de l'extraction.
 */
export function withInventory(tag: AudioTag, inventory: AudioInventory | undefined): AudioTag {
  if (tag.content !== "unknown" || !tag.lang || !inventory) return tag;
  if (tag.lang === inventory.original) return { ...tag, content: "original" };
  if (inventory.autoDubbed.includes(tag.lang)) return { ...tag, content: "dubbed-auto" };
  if (inventory.dubbed.includes(tag.lang)) return { ...tag, content: "dubbed" };
  return tag;
}
