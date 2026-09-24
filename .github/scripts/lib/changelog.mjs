// Extraction des notes de version depuis CHANGELOG.md + conversion par store.
// Convention : un bloc par CANAL « ## [<canal>-<version>] » (canaux : mac, ios,
// atv, win, play) avec sous-sections « ### FR » / « ### EN ». Repli sur le bloc
// nu « ## [x.y.z] » pour les entrées historiques. Zéro dépendance npm.
import fs from 'node:fs';

/** Limites de caractères par cible (texte brut). GitHub : aucune. */
export const LIMITS = { asc: 4000, play: 500, msstore: 1500 };

/**
 * Caractères qu'App Store Connect REFUSE dans les notes, aussi bien dans
 * « Nouveautés de cette version » que dans « À tester » de TestFlight. Liste
 * FERMÉE, tenue sur ce qu'Apple a réellement renvoyé : le refus vise des
 * caractères précis, pas les symboles en général — ⌘ ⇥ « » — et … sont passés
 * dans le même texte. Un nouveau refus observé s'ajoute ici, daté.
 *
 * Pourquoi c'est grave : les scripts de notes sont non bloquants, une version
 * refusée reste donc SANS « Nouveautés », et c'est la soumission à l'examen qui
 * échoue ensuite (409 ENTITY_STATE_INVALID).
 */
export const ASC_FORBIDDEN = [
  // Observé le 2026-09-23 (macOS 1.22.0) : 409 INVALID_CHARACTERS sur les
  // Nouveautés, 409 INVALID_TEXT sur « À tester ».
  { char: '✓', code: 'U+2713', why: 'refusé par App Store Connect (observé le 2026-09-23)' },
  // NON observé : écarté par analogie, c'est la variante grasse de ✓.
  { char: '✔', code: 'U+2714', why: 'variante grasse de ✓, écartée par analogie (refus non observé)' },
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extrait la section du CHANGELOG pour (channel, version).
 * Cherche `## [<channel>-<version>]` puis replie sur `## [<version>]` nu.
 * @returns {{ raw: string, fr: string|null, en: string|null, start: number, end: number } | null}
 *   raw = bloc markdown brut (sans le titre), fr/en = sous-sections markdown,
 *   start/end = indices (base 0) de la ligne de titre et de la fin exclue, pour
 *   pouvoir désigner une ligne du fichier.
 */
export function extractSection(md, { channel, version }) {
  const lines = md.split('\n');
  const patterns = [];
  if (channel) patterns.push(new RegExp(`^##\\s*\\[${esc(channel)}-${esc(version)}\\](\\s|$)`));
  patterns.push(new RegExp(`^##\\s*\\[?${esc(version)}\\]?(\\s|$)`));

  let start = -1;
  for (const re of patterns) {
    start = lines.findIndex((l) => re.test(l));
    if (start >= 0) break;
  }
  if (start < 0) return null;

  // Fin de section : prochain « ## » OU séparateur « --- » (footer du fichier).
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^---\s*$/.test(lines[i])) { end = i; break; }
  }
  const block = lines.slice(start + 1, end);

  const grab = (tag) => {
    const s = block.findIndex((l) => new RegExp(`^###\\s*${tag}\\b`, 'i').test(l));
    if (s < 0) return null;
    let e = block.length;
    for (let i = s + 1; i < block.length; i++) if (/^###\s/.test(block[i])) { e = i; break; }
    return block.slice(s + 1, e).join('\n').trim();
  };

  const fr = grab('FR');
  const en = grab('EN') ?? grab('English');
  return {
    raw: block.join('\n').trim(),
    fr: fr ?? block.join('\n').trim(),
    en: en ?? fr ?? block.join('\n').trim(),
    start,
    end,
  };
}

/**
 * Les caractères d'ASC_FORBIDDEN du bloc retenu, ligne par ligne, numérotées
 * comme dans le fichier. `sent` porte les textes RÉELLEMENT envoyés par langue
 * (après mise en forme et coupe) : un caractère qui n'y figure pas — coupé par
 * la limite, ou dans une sous-section qui ne part pas — ne compte pas.
 * @returns {{ char: string, code: string, why: string, line: number, lang: string|null }[]}
 */
export function findAscForbidden(md, section, sent) {
  const block = md.split('\n').slice(section.start + 1, section.end);
  const hits = [];
  let lang = null;
  block.forEach((text, i) => {
    if (/^###/.test(text)) {
      lang = /^###\s*FR\b/i.test(text) ? 'FR' : /^###\s*(EN|English)\b/i.test(text) ? 'EN' : null;
      return;
    }
    for (const forbidden of ASC_FORBIDDEN) {
      if (!text.includes(forbidden.char)) continue;
      if (!Object.values(sent).some((t) => t?.includes(forbidden.char))) continue;
      hits.push({ ...forbidden, line: section.start + 2 + i, lang });
    }
  });
  return hits;
}

/** Markdown → texte brut store-safe (gras/italique/code/liens/puces). */
export function toPlainText(mdText) {
  return mdText
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                  // images → alt
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')                 // liens [t](u) → t
    .replace(/`([^`]*)`/g, '$1')                               // `code` → code
    .replace(/\*\*([^*]+)\*\*/g, '$1')                         // **gras**
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2')   // *italique*
    .replace(/(^|[^\w_])_([^_\n]+)_(?=[^\w_]|$)/g, '$1$2')
    .replace(/^#{3,6}\s*/gm, '')                               // titres internes → texte nu
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')                       // puces (y compris imbriquées)
    .replace(/^>\s?/gm, '')                                    // citations
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Tronque à `max` caractères en coupant à la fin d'une puce/ligne complète. */
export function truncateAtBullet(text, max) {
  if (!max || text.length <= max) return text;
  const cut = text.slice(0, max);
  const nl = cut.lastIndexOf('\n');
  if (nl > 0) return cut.slice(0, nl).trimEnd();
  return cut.slice(0, max - 1).trimEnd() + '…';
}

/** Lit le CHANGELOG et renvoie les notes prêtes pour une cible donnée. */
export function loadNotes({ changelog = 'CHANGELOG.md', channel, version, format = 'github' }) {
  const md = fs.readFileSync(changelog, 'utf8');
  const section = extractSection(md, { channel, version });
  if (!section) return null;
  if (format === 'github') return section;
  const limit = LIMITS[format];
  return {
    raw: section.raw,
    fr: section.fr != null ? truncateAtBullet(toPlainText(section.fr), limit) : null,
    en: section.en != null ? truncateAtBullet(toPlainText(section.en), limit) : null,
  };
}
