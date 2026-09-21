// Client App Store Connect minimal : JWT ES256 signé maison, RE-MINTÉ toutes
// les ~8 min (les tokens ASC expirent à 600 s — indispensable pour les scripts
// qui pollent longtemps, ex. asc-attach-build). Zéro dépendance npm.
import crypto from 'node:crypto';

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/**
 * @returns {(method: string, path: string, body?: object) => Promise<any>}
 *   Client fetch vers l'API ASC ; throw avec le détail `errors` en cas d'échec.
 */
export function createAscClient({ keyId, issuer, p8, api = 'https://api.appstoreconnect.apple.com' }) {
  let token = null;
  let mintedAt = 0;

  const mint = () => {
    const now = Math.floor(Date.now() / 1000);
    const input = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })) + '.' +
      b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
    const sig = crypto.sign('SHA256', Buffer.from(input), { key: p8, dsaEncoding: 'ieee-p1363' });
    return input + '.' + b64url(sig);
  };

  const bearer = () => {
    if (!token || Date.now() - mintedAt > 8 * 60_000) { token = mint(); mintedAt = Date.now(); }
    return token;
  };

  return async (method, path, body) => {
    const r = await fetch(api + path, {
      method,
      headers: { Authorization: `Bearer ${bearer()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j.errors ?? j)}`);
    return j;
  };
}

/** Récupère l'app ASC par bundleId (throw si introuvable). */
export async function findApp(api, bundleId) {
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${bundleId}&limit=1`);
  const app = apps.data?.[0];
  if (!app) throw new Error(`app ${bundleId} introuvable sur App Store Connect`);
  return app;
}

/** Version App Store (versionString, platform) — créée si absente. */
export async function ensureAppStoreVersion(api, appId, { version, platform }) {
  const vers = await api('GET', `/v1/apps/${appId}/appStoreVersions?filter[versionString]=${version}&filter[platform]=${platform}&limit=1`);
  let ver = vers.data?.[0];
  if (!ver) {
    console.log(`[asc] création de la version App Store ${version} (${platform})`);
    ver = (await api('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform, versionString: version },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    })).data;
  }
  return ver;
}

// ── Ce que trois scripts ASC refaisaient chacun de leur côté ────────────────

/** PLATFORM ASC → canal de changelog (bloc « ## [<canal>-<version>] »). */
export const CHANNEL_BY_PLATFORM = { MAC_OS: 'mac', IOS: 'ios', TV_OS: 'atv' };

/** Les deux seules langues publiées sur les fiches. */
export const ASC_LOCALES = ['fr-FR', 'en-US'];

/** `{ fr, en }` → `[[locale, texte], …]`, les vides retirés. */
export const localePairs = (notes) =>
  [['fr-FR', notes?.fr], ['en-US', notes?.en]].filter(([, t]) => t);

/**
 * Le build d'une version donnée. TRIPLE filtre indispensable : la fiche
 * com.tentacle.mobile est PARTAGÉE mac/iOS/tvOS — un même numéro de build peut
 * exister sur plusieurs plateformes.
 */
export async function findBuild(api, appId, { build, version, platform }) {
  const r = await api('GET',
    `/v1/builds?filter[app]=${appId}` +
    `&filter[version]=${build}` +
    (version ? `&filter[preReleaseVersion.version]=${version}` : '') +
    `&filter[preReleaseVersion.platform]=${platform}` +
    `&sort=-uploadedDate&limit=1`);
  return r.data?.[0] ?? null;
}

/**
 * « À tester » TestFlight. L'attribut s'appelle bien `whatsNew`, comme les
 * Nouveautés App Store : « whatsToTest » n'existe pas et renvoie 409.
 */
export async function setBetaBuildNotes(api, buildId, pairs, log = console.log) {
  const bl = await api('GET', `/v1/builds/${buildId}/betaBuildLocalizations?limit=50`);
  for (const [locale, text] of pairs) {
    const existing = bl.data.find((l) => l.attributes.locale === locale);
    if (existing) {
      await api('PATCH', `/v1/betaBuildLocalizations/${existing.id}`,
        { data: { type: 'betaBuildLocalizations', id: existing.id, attributes: { whatsNew: text } } });
    } else {
      await api('POST', '/v1/betaBuildLocalizations',
        { data: { type: 'betaBuildLocalizations', attributes: { locale, whatsNew: text }, relationships: { build: { data: { type: 'builds', id: buildId } } } } });
    }
    log(`« À tester » ${locale} ✓`);
  }
}

/**
 * « Nouveautés de cette version » sur la fiche App Store. On PATCHE `whatsNew`
 * et RIEN d'autre : description, mots-clés, texte promotionnel et captures
 * appartiennent à l'utilisateur, la CI n'y touche jamais.
 */
export async function setAppStoreNotes(api, versionId, pairs, log = console.log) {
  const locs = await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`);
  for (const [locale, text] of pairs) {
    const existing = locs.data.find((l) => l.attributes.locale === locale);
    try {
      if (existing) {
        await api('PATCH', `/v1/appStoreVersionLocalizations/${existing.id}`,
          { data: { type: 'appStoreVersionLocalizations', id: existing.id, attributes: { whatsNew: text } } });
      } else {
        await api('POST', '/v1/appStoreVersionLocalizations',
          { data: { type: 'appStoreVersionLocalizations', attributes: { locale, whatsNew: text }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } } } });
      }
      log(`« Nouveautés » ${locale} ✓ (${text.length} car.)`);
    } catch (e) {
      log(`whatsNew ${locale} échec (non bloquant): ${e.message}`);
    }
  }
}

/**
 * États d'une version App Store où le build et les métadonnées sont modifiables.
 * `READY_FOR_REVIEW` en fait partie : il ne veut pas dire « partie à l'examen »
 * mais « tout est rempli, rien n'a encore été envoyé » — c'est précisément
 * l'état qu'atteint une version une fois son build rattaché.
 */
export const EDITABLE_VERSION_STATES = new Set([
  'PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW',
  'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY',
]);

/**
 * États d'une version DÉJÀ envoyée ou déjà en vente : rejouer un run ne doit
 * rien casser. Les deux générations d'énumération y cohabitent — `versionState`
 * lit `appVersionState` en priorité, mais retombe sur `appStoreState`.
 */
export const SUBMITTED_VERSION_STATES = new Set([
  // appVersionState
  'WAITING_FOR_REVIEW', 'IN_REVIEW', 'ACCEPTED', 'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE', 'PROCESSING_FOR_DISTRIBUTION',
  'READY_FOR_DISTRIBUTION', 'WAITING_FOR_EXPORT_COMPLIANCE', 'REPLACED_WITH_NEW_VERSION',
  // appStoreState (déprécié, encore servi par certaines réponses)
  'READY_FOR_SALE', 'PROCESSING_FOR_APP_STORE', 'PENDING_CONTRACT', 'PREORDER_READY_FOR_SALE',
]);

/** L'état d'une version : `appVersionState` fait foi, `appStoreState` est déprécié. */
export const versionState = (ver) => ver?.attributes?.appVersionState ?? ver?.attributes?.appStoreState ?? null;
