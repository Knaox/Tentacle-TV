export interface UpdateNote {
  /** Intitulé mis en avant — la partie avant le premier « : », quand elle est courte. */
  title?: string;
  body: string;
}

const BULLET = /^[•\-*–]\s*/;
const MAX_TITLE_LENGTH = 64;

/**
 * Notes du manifeste → liste. Le format est un texte aplati par la CI
 * (`toPlainText` de .github/scripts/lib/changelog.mjs) : une puce par ligne,
 * « • » en tête, le gras du changelog perdu — mais l'intitulé qu'il portait
 * survit sous la forme « Intitulé : reste » (« Title: rest » en anglais). On le
 * retrouve ici, sans parser de markdown : il n'y en a plus. Une ligne sans
 * puce (le chapeau des notes simulées) est une entrée comme une autre.
 */
export function parseUpdateNotes(notes: string | undefined): UpdateNote[] {
  if (!notes) return [];
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim().replace(BULLET, "").trim())
    .filter((line) => line.length > 0)
    .map(splitTitle);
}

function splitTitle(line: string): UpdateNote {
  const match = /^(.+?)\s?:\s+(.+)$/.exec(line);
  if (!match) return { body: line };
  const [, head, rest] = match;
  // Un « : » loin dans la phrase n'introduit rien — pas plus qu'une phrase
  // déjà terminée avant lui.
  if (head.length > MAX_TITLE_LENGTH || /\.\s/.test(head)) return { body: line };
  return { title: head.trim(), body: rest.trim() };
}
