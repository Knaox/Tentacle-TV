/* ------------------------------------------------------------------ */
/*  Les sous-titres de YouTube en WebVTT propre — fonctions pures      */
/*                                                                     */
/*  Le `vtt` que sert YouTube pour sa reconnaissance vocale est fait   */
/*  pour son lecteur : des répliques qui défilent (chaque ligne y      */
/*  paraît deux fois, la précédente au-dessus) et un minutage mot à    */
/*  mot. On lui préfère le `json3` — une réplique par évènement — que  */
/*  l'on convertit : une ligne à la fois, chacune finie quand la       */
/*  suivante commence. Les pistes posées par la chaîne y gagnent aussi */
/*  (pas de balisage de position à interpréter).                       */
/* ------------------------------------------------------------------ */

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  aAppend?: number;
  segs?: Array<{ utf8?: string }>;
}

interface Cue {
  start: number;
  end: number;
  text: string;
}

/** Une réplique plus courte ne se lit pas : elle n'est pas gardée. */
const MIN_CUE_MS = 80;

function timestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(total % 1000, 3)}`;
}

/** Le texte d'une réplique, sûr pour WebVTT : entités échappées, aucune ligne vide (elle finirait le bloc). */
function cueText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderVtt(cues: Cue[]): string {
  const blocks = cues.map((c) => `${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}`);
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}

/** `json3` de YouTube → WebVTT ; `null` si ce n'en est pas. */
export function json3ToVtt(body: string): string | null {
  let events: Json3Event[];
  try {
    const parsed = JSON.parse(body) as { events?: unknown };
    if (!Array.isArray(parsed.events)) return null;
    events = parsed.events as Json3Event[];
  } catch {
    return null;
  }
  const cues: Cue[] = [];
  for (const event of events) {
    // `aAppend` : le saut de ligne qu'ajoute le défilement de la reconnaissance vocale.
    if (event.aAppend || !event.segs || typeof event.tStartMs !== "number") continue;
    const text = cueText(event.segs.map((seg) => seg.utf8 ?? "").join(""));
    if (!text) continue;
    cues.push({ start: event.tStartMs, end: event.tStartMs + (event.dDurationMs ?? 0), text });
  }
  cues.sort((a, b) => a.start - b.start);
  // Une ligne à la fois : chacune s'efface quand la suivante paraît.
  for (let i = 0; i < cues.length - 1; i++) cues[i].end = Math.min(cues[i].end, cues[i + 1].start);
  return renderVtt(cues.filter((c) => c.end - c.start >= MIN_CUE_MS));
}

/** Le corps d'une piste amont, rendu en WebVTT ; `null` s'il est illisible. */
export function toWebVtt(body: string, format: "json3" | "vtt"): string | null {
  if (format === "json3") return json3ToVtt(body);
  const text = body.replace(/^\uFEFF/, "");
  return text.startsWith("WEBVTT") ? text : null;
}
