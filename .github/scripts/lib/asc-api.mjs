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
