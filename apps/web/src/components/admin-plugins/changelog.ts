/**
 * Les notes de version d'un plugin, telles que son registre les publie :
 * du Markdown sommaire, un bloc `### FR` et un bloc `### EN`.
 *
 * Lu en structures (titres, puces, gras, code) et rendu en éléments React —
 * JAMAIS injecté en HTML : le texte vient d'un registre, parfois tiers. Les
 * liens gardent leur texte et perdent leur cible, pour la même raison.
 */

export interface ChangelogSpan {
  text: string;
  strong?: boolean;
  code?: boolean;
}

export type ChangelogBlock =
  | { kind: "heading"; spans: ChangelogSpan[] }
  | { kind: "item"; depth: number; spans: ChangelogSpan[] }
  | { kind: "paragraph"; spans: ChangelogSpan[] };

const HEADING = /^#{1,6}\s+(.*)$/;
const LANGUAGE = /^(fr|en)$/i;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;

/**
 * Le bloc de la langue voulue (« fr », « en-US »…), l'anglais à défaut, le
 * premier bloc sinon ; le texte entier s'il n'est pas découpé par langue.
 */
export function changelogFor(text: string, language: string): string {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim().match(HEADING);
    const lang = heading?.[1].trim();
    if (lang && LANGUAGE.test(lang)) {
      current = [];
      sections.set(lang.toLowerCase(), current);
      continue;
    }
    current?.push(line);
  }
  if (sections.size === 0) return text.trim();
  const wanted = language.slice(0, 2).toLowerCase();
  const chosen = sections.get(wanted) ?? sections.get("en") ?? [...sections.values()][0];
  return chosen.join("\n").trim();
}

/** `**gras**`, `` `code` `` et `[texte](lien)` → segments ; le reste tel quel. */
export function parseInline(text: string): ChangelogSpan[] {
  const spans: ChangelogSpan[] = [];
  // La cible d'un lien peut porter une paire de parenthèses (« alert(1) ») :
  // elle est consommée en entier, pour ne pas laisser traîner une « ) ».
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) spans.push({ text: text.slice(last, index) });
    if (match[1] !== undefined) spans.push({ text: match[1], strong: true });
    else if (match[2] !== undefined) spans.push({ text: match[2], code: true });
    else spans.push({ text: match[3] });
    last = index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans;
}

/** Les blocs à afficher ; une ligne sans puce qui suit une puce la prolonge. */
export function parseChangelog(text: string): ChangelogBlock[] {
  const blocks: ChangelogBlock[] = [];
  let open: { kind: "item" | "paragraph"; depth: number; raw: string } | null = null;
  const flush = () => {
    if (open) {
      blocks.push(open.kind === "item"
        ? { kind: "item", depth: open.depth, spans: parseInline(open.raw) }
        : { kind: "paragraph", spans: parseInline(open.raw) });
    }
    open = null;
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = trimmed.match(HEADING);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", spans: parseInline(heading[1].trim()) });
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet) {
      flush();
      open = { kind: "item", depth: bullet[1].length >= 2 ? 1 : 0, raw: bullet[2].trim() };
      continue;
    }
    if (open) open.raw += ` ${trimmed}`;
    else open = { kind: "paragraph", depth: 0, raw: trimmed };
  }
  flush();
  return blocks;
}
