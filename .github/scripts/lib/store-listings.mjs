// Ce que les boutiques affichent PUBLIQUEMENT — la preuve qu'une version est
// réellement en ligne là où l'API du développeur ne sait pas le dire.
//
// Ni Google Play ni le Microsoft Store n'exposent la version servie : Play
// garde la piste « completed » pendant tout son examen, et la vitrine publique
// de Microsoft rend une version vide. Mais tous deux affichent les NOTES de la
// version en ligne (« What's new » / « Payload.Notes »), et ces notes sont
// celles que la CI a tirées du changelog, bloc par bloc. Retrouver le bloc dont
// la mise en forme est identique au texte affiché, c'est donc lire la version
// en ligne — sans secret, sans rien écrire nulle part.
//
// Aucune de ces lectures ne lève : une page injoignable ou méconnaissable rend
// null, et l'appelant la traite comme « inconnu », jamais comme « rien ».

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const TIMEOUT_MS = 20_000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Décodage des entités HTML courantes (nommées et numériques). */
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

/**
 * Forme comparable d'un texte de notes : les boutiques retouchent les
 * apostrophes, les guillemets et les blancs, jamais les mots.
 */
export function normalizeNotes(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Le bloc « What's new » d'une page de fiche Play, en texte brut. */
export function extractPlayWhatsNew(html) {
  const m = html.match(
    /What(?:’|'|&#39;|&#8217;|&rsquo;)s new<\/h2>[\s\S]{0,2000}?itemprop="description"[^>]*>([\s\S]*?)<\/div>/,
  );
  if (!m) return null;
  const text = decodeEntities(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
  return text || null;
}

/** Les notes de la version en ligne, dans la réponse de la vitrine Microsoft. */
export function extractMsStoreNotes(json) {
  const notes = json?.Payload?.Notes;
  const text = Array.isArray(notes) ? notes.filter((n) => typeof n === 'string').join('\n') : null;
  return text?.trim() || null;
}

/**
 * La version dont les notes, mises en forme pour la boutique par `notesFor`,
 * sont exactement celles affichées. `versions` est parcourue dans l'ordre :
 * la première qui correspond gagne.
 */
export function matchNotesVersion(shown, versions, notesFor) {
  const target = normalizeNotes(shown);
  if (!target) return null;
  for (const v of versions) {
    const expected = notesFor(v);
    if (expected && normalizeNotes(expected) === target) return v;
  }
  return null;
}

async function get(url, log) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) {
      log(`${url} → ${r.status}`);
      return null;
    }
    return r;
  } catch (e) {
    log(`${url} → ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Notes affichées sur la fiche Play publique (fiche anglaise, téléphone). */
export async function fetchPlayWhatsNew(pkg, log = console.error) {
  const r = await get(
    `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en_US&gl=US`,
    log,
  );
  return r ? extractPlayWhatsNew(await r.text()) : null;
}

/** Notes affichées par la vitrine publique du Microsoft Store (en-us). */
export async function fetchMsStoreNotes(productId, log = console.error) {
  const r = await get(
    `https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${encodeURIComponent(productId)}?market=US&locale=en-us&deviceFamily=Windows.Desktop`,
    log,
  );
  if (!r) return null;
  try {
    return extractMsStoreNotes(await r.json());
  } catch {
    log('vitrine Microsoft : réponse illisible');
    return null;
  }
}
