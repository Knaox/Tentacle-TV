// Extraction des notes de version depuis CHANGELOG.md + conversion par store.
// Convention : un bloc par CANAL « ## [<canal>-<version>] » (canaux : mac, ios,
// atv, win, play) avec sous-sections « ### FR » / « ### EN ». Repli sur le bloc
// nu « ## [x.y.z] » pour les entrées historiques. Zéro dépendance npm.
import fs from 'node:fs';
import { changelogVersions, compareVersions, isVersion } from './versions.mjs';

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

/**
 * Les versions dont les notes partent avec `version` : elle-même, et celles du
 * changelog que la boutique n'a JAMAIS servies — strictement au-dessus de
 * `since` (la version qu'elle sert aujourd'hui). De la plus récente à la plus
 * ancienne : la coupe à la limite du store garde donc toujours la livrée.
 *
 * POURQUOI. Les plateformes n'avancent pas au même pas : le bureau Windows
 * peut être en 1.28.1 quand macOS sert encore la 1.25.3. Livrer macOS 1.28.1
 * avec le seul bloc 1.28.1 taisait tout ce que 1.26 à 1.28.0 apportaient à
 * ses utilisateurs. `since` inconnu (null) ou pas en dessous : la seule version.
 */
export function notesVersions(md, { version, since }) {
  if (!isVersion(since) || !isVersion(version) || compareVersions(since, version) >= 0) return [version];
  const skipped = changelogVersions(md).filter((v) =>
    compareVersions(v, since) > 0 && compareVersions(v, version) < 0);
  return [version, ...skipped];
}

/**
 * La section de `version`, augmentée des versions sautées (`notesVersions`).
 * Les textes FR et EN se suivent, du plus récent au plus ancien ; le markdown
 * brut (`raw`, pour GitHub) regroupe tout le français puis tout l'anglais. Le
 * bloc de `version` est EXIGÉ (null sans lui) ; un bloc sauté absent est passé.
 * `start`/`end` restent ceux du bloc de `version` (findAscForbidden lit les
 * autres par leurs propres bornes, via `sections`).
 */
export function extractCumulative(md, { channel, version, since }) {
  const own = extractSection(md, { channel, version });
  if (!own) return null;
  const versions = notesVersions(md, { version, since });
  const sections = [{ version, section: own }];
  for (const v of versions.slice(1)) {
    const section = extractSection(md, { channel, version: v });
    if (section) sections.push({ version: v, section });
  }
  if (sections.length === 1) return { ...own, versions: [version], sections };
  const join = (lang) => sections.map(({ section }) => section[lang]).filter((t) => t?.trim()).join('\n');
  const fr = join('fr');
  const en = join('en');
  return {
    raw: `### FR\n\n${fr}\n\n### EN\n\n${en}`,
    fr, en,
    start: own.start, end: own.end,
    versions: sections.map((s) => s.version),
    sections,
  };
}

/**
 * Lit le CHANGELOG et renvoie les notes prêtes pour une cible donnée.
 * `since` : la version que la boutique sert déjà — les notes des versions
 * qu'elle a sautées s'ajoutent (`extractCumulative`). Omis : la seule version.
 */
export function loadNotes({ changelog = 'CHANGELOG.md', channel, version, since = null, format = 'github' }) {
  const md = fs.readFileSync(changelog, 'utf8');
  const section = extractCumulative(md, { channel, version, since });
  if (!section) return null;
  if (format === 'github') return section;
  const limit = LIMITS[format];
  // Pour Apple, les caractères refusés sont retirés : le pré-vol ne contrôle
  // que le bloc de la version livrée, pas ceux des versions sautées, et un seul
  // « ✓ » ferait rejeter toutes les notes (puis la soumission).
  const clean = format === 'asc'
    ? (t) => ASC_FORBIDDEN.reduce((acc, f) => acc.split(f.char).join(''), t).replace(/[ \t]+$/gm, '')
    : (t) => t;
  const plain = (md) => (md != null ? truncateAtBullet(clean(toPlainText(md)), limit) : null);
  return { raw: section.raw, versions: section.versions, fr: plain(section.fr), en: plain(section.en) };
}

/** « 1.28.1 », ou « 1.28.1 (+ 1.28.0, 1.27.0) » quand des versions sautées suivent. */
export const describeNotesVersions = (versions) =>
  versions.length > 1 ? `${versions[0]} (+ ${versions.slice(1).join(', ')})` : versions[0];
