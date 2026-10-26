/**
 * Octave — les règles PURES des ambiances : quelle ambiance une recherche NOMME (comparée aux mots que l'extension
 * donne, localement, sans requête), et la teinte d'une carte (sa couleur, assombrie là où le texte se pose).
 *
 * Une recherche nomme une ambiance quand, une fois les mots de remplissage ôtés (« musique », « pour », « playlist »…),
 * elle EST l'un de ses mots (« chill », « musique pour dormir »), ou qu'elle en contient un en entier et reste courte
 * (trois mots au plus : « chill vibes ») ; un seul mot de quatre lettres au moins peut aussi en être le début
 * (« détent »). Un titre de chanson plus long (« running up that hill ») ne fait pas sortir « Sport ».
 */

import type { ExternalMusicMood } from "@tentacle-tv/shared/music";

const FILLERS = new Set(["musique", "musiques", "music", "playlist", "playlists", "mix", "pour", "for", "de", "du", "des", "la", "le", "les", "une", "un", "a", "an", "the", "to", "songs", "chansons", "titres", "ambiance", "mood", "vibe", "vibes"]);

export function normalizeMoodText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const meaningful = (text: string): string[] => normalizeMoodText(text).split(" ").filter((w) => w.length > 0 && !FILLERS.has(w));

/** Le degré de correspondance (3 : exact, 2 : contenu, 1 : début de mot) ; 0 : aucune. */
function scoreOf(query: string[], keyword: string): number {
  const words = normalizeMoodText(keyword).split(" ").filter(Boolean);
  if (words.length === 0 || query.length === 0) return 0;
  const q = query.join(" ");
  const k = words.join(" ");
  if (q === k) return 3;
  if (query.length <= 3 && ` ${q} `.includes(` ${k} `)) return 2;
  if (query.length === 1 && q.length >= 4 && k.startsWith(q)) return 1;
  return 0;
}

/** Les ambiances que la recherche nomme, la meilleure d'abord (deux au plus). */
export function moodsNamedBy(query: string, moods: readonly ExternalMusicMood[], max = 2): ExternalMusicMood[] {
  const words = meaningful(query);
  const words0 = words.length > 0 ? words : normalizeMoodText(query).split(" ").filter(Boolean);
  return moods
    .map((mood, index) => ({ mood, index, score: Math.max(0, ...mood.keywords.map((k) => scoreOf(words0, k))) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .map((m) => m.mood);
}

const HEX = /^#([0-9a-f]{6})$/i;

/** La couleur assombrie (`amount` de 0 à 1 vers le noir) ; une couleur illisible rend l'encre d'Octave. */
export function shade(color: string, amount: number): string {
  const match = HEX.exec(color);
  if (!match) return "#0e0b13";
  const value = parseInt(match[1]!, 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Le fond d'une carte d'ambiance : assombri en haut à gauche, là où le nom se pose (blanc lisible), sa couleur vers le bas. */
export function moodBackground(color: string): string {
  return `linear-gradient(135deg, ${shade(color, 0.4)} 0%, ${color} 100%)`;
}
