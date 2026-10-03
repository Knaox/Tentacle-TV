/**
 * L'essentiel des nouveautés d'une publication du serveur, tiré de ses notes :
 * les blocs `### FR` et `### EN` que la CI recopie de `changelogs/server.md`.
 * On en garde les premiers points, réduits à leur titre quand il en ont un
 * (« **Les bandes-annonces passent par le serveur** : … »), sinon le point
 * entier, nettoyé de son Markdown et raccourci. Le texte n'est jamais rendu
 * en HTML : ce sont des chaînes, affichées telles quelles.
 */

const MAX_HIGHLIGHTS = 4;
const MAX_LENGTH = 140;
/** Un titre en gras d'un ou deux mots (« **Administrateurs** : … ») ne dit rien seul. */
const MIN_TITLE_WORDS = 3;

export interface ReleaseHighlights {
  fr: string[];
  en: string[];
}

export function releaseHighlights(body: unknown, max = MAX_HIGHLIGHTS): ReleaseHighlights {
  if (typeof body !== "string") return { fr: [], en: [] };
  return { fr: bulletsOf(sectionOf(body, "FR"), max), en: bulletsOf(sectionOf(body, "EN"), max) };
}

/** Les lignes sous le titre `### FR` (ou `## FR`), jusqu'au titre suivant. */
function sectionOf(body: string, language: "FR" | "EN"): string[] {
  const lines: string[] = [];
  let inside = false;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^#{2,4}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      inside = (heading[1] ?? "").trim().toUpperCase() === language;
      continue;
    }
    if (inside) lines.push(line);
  }
  return lines;
}

function bulletsOf(lines: string[], max: number): string[] {
  const highlights: string[] = [];
  for (const line of lines) {
    if (highlights.length >= max) break;
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const headline = bullet ? headlineOf(bullet[1] ?? "") : null;
    if (headline) highlights.push(headline);
  }
  return highlights;
}

function headlineOf(raw: string): string | null {
  const bold = /^\*\*(.+?)\*\*/.exec(raw.trim());
  const title = bold ? plain(bold[1] ?? "") : "";
  if (title.split(" ").length >= MIN_TITLE_WORDS) return clip(title);
  const text = plain(raw);
  return text ? clip(text) : null;
}

/** Liens réduits à leur texte, gras et code retirés, espaces resserrés, ponctuation finale ôtée. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s:;,.]+$/, "");
}

/** Au-delà de la longueur, coupé au dernier mot entier, avec une ellipse. */
function clip(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.slice(0, MAX_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX_LENGTH / 2 ? cut.slice(0, space) : cut).replace(/[\s:;,.(]+$/, "")}…`;
}
