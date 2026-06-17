// Remplit les notes de version sur App Store Connect depuis CHANGELOG.md (FR + EN).
// - « Nouveautés de cette version » (appStoreVersionLocalizations.whatsNew) : crée la
//   version App Store si besoin puis écrit les notes fr-FR + en-US.
// - « À tester » (betaBuildLocalizations.whatsToTest) : best-effort sur le build s'il
//   est déjà traité par Apple (sinon ignoré, sans échouer).
// NON BLOQUANT : toute erreur est loggée mais n'échoue pas le job (exit 0).
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8 (contenu .p8),
//   BUNDLE_ID, PLATFORM (MAC_OS|IOS|TV_OS), VERSION, BUILD, CHANGELOG (chemin).
import crypto from 'crypto';
import fs from 'fs';

const { ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID, PLATFORM = 'MAC_OS', VERSION, BUILD, CHANGELOG = 'CHANGELOG.md' } = process.env;
const API = 'https://api.appstoreconnect.apple.com';
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function jwt() {
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ASC_ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' };
  const input = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const sig = crypto.sign('SHA256', Buffer.from(input), { key: ASC_KEY_P8, dsaEncoding: 'ieee-p1363' });
  return input + '.' + b64url(sig);
}
const H = { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' };
const api = async (m, p, body) => {
  const r = await fetch(`${API}${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${JSON.stringify(j.errors || j)}`);
  return j;
};

// Extrait la section « ## [VERSION] » du changelog → { fr, en } (plain text).
function extractNotes() {
  const md = fs.readFileSync(CHANGELOG, 'utf8');
  const lines = md.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^##\\s*\\[?${VERSION.replace(/\./g, '\\.')}\\]?(\\s|$)`).test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^##\s/.test(lines[i])) { end = i; break; }
  const block = lines.slice(start + 1, end);
  const grab = (tag) => {
    const s = block.findIndex((l) => new RegExp(`^###\\s*${tag}\\b`, 'i').test(l));
    if (s < 0) return null;
    let e = block.length;
    for (let i = s + 1; i < block.length; i++) if (/^###\s/.test(block[i])) { e = i; break; }
    return clean(block.slice(s + 1, e));
  };
  const clean = (arr) => arr.join('\n').replace(/^[-*]\s?/gm, '• ').replace(/`/g, '').trim();
  const fr = grab('FR') || clean(block);
  const en = grab('EN') || grab('English') || fr;
  return { fr, en };
}

const main = async () => {
  const notes = extractNotes();
  if (!notes) { console.log(`[notes] pas de section CHANGELOG pour ${VERSION} — ignoré.`); return; }
  const locales = [['fr-FR', notes.fr], ['en-US', notes.en]];

  // app id
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`);
  const app = apps.data?.[0];
  if (!app) { console.log(`[notes] app ${BUNDLE_ID} introuvable.`); return; }

  // ── « Nouveautés » : version App Store (créée si absente) ──
  let vers = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[versionString]=${VERSION}&filter[platform]=${PLATFORM}&limit=1`);
  let ver = vers.data?.[0];
  if (!ver) {
    console.log(`[notes] création version App Store ${VERSION} (${PLATFORM})`);
    ver = (await api('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: PLATFORM, versionString: VERSION }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
  }
  const locs = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`);
  for (const [locale, text] of locales) {
    const existing = locs.data.find((l) => l.attributes.locale === locale);
    try {
      if (existing) await api('PATCH', `/v1/appStoreVersionLocalizations/${existing.id}`, { data: { type: 'appStoreVersionLocalizations', id: existing.id, attributes: { whatsNew: text } } });
      else await api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale, whatsNew: text }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
      console.log(`[notes] « Nouveautés » ${locale} ✓`);
    } catch (e) { console.log(`[notes] whatsNew ${locale} échec (non bloquant): ${e.message}`); }
  }

  // ── « À tester » TestFlight : best-effort si le build est déjà traité ──
  try {
    const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD}&limit=1`);
    const build = builds.data?.[0];
    if (!build) { console.log(`[notes] build ${BUILD} pas encore traité par Apple — « À tester » à définir plus tard.`); return; }
    const bl = await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations?limit=50`);
    for (const [locale, text] of locales) {
      const existing = bl.data.find((l) => l.attributes.locale === locale);
      if (existing) await api('PATCH', `/v1/betaBuildLocalizations/${existing.id}`, { data: { type: 'betaBuildLocalizations', id: existing.id, attributes: { whatsToTest: text } } });
      else await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale, whatsToTest: text }, relationships: { build: { data: { type: 'builds', id: build.id } } } } });
      console.log(`[notes] « À tester » ${locale} ✓`);
    }
  } catch (e) { console.log(`[notes] whatsToTest échec (non bloquant): ${e.message}`); }
};

main().catch((e) => { console.log('[notes] erreur globale (non bloquant):', e.message); process.exit(0); });
