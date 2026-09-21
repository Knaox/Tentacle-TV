// Client Google Play (androidpublisher v3) minimal : JWT RS256 signé maison
// échangé contre un jeton OAuth2, puis du REST nu. ZÉRO DÉPENDANCE NPM.
//
// POURQUOI PAS googleapis. Le job qui publie a déjà installé les dépendances
// du workspace avec pnpm ; y lancer « npm install googleapis » réécrit un
// node_modules que pnpm gère en ferme de liens symboliques. Et un import ESM
// ne suit pas NODE_PATH, donc l'installer à côté ne résout rien proprement.
// Le client ASC (lib/asc-api.mjs) est déjà écrit ainsi : même idiome.
import crypto from 'node:crypto';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Jeton OAuth2 depuis un compte de service (assertion JWT RS256). */
async function mintToken({ client_email, private_key }) {
  const now = Math.floor(Date.now() / 1000);
  const input =
    b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    b64url(JSON.stringify({
      iss: client_email, scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    }));
  const assertion = input + '.' + b64url(crypto.sign('RSA-SHA256', Buffer.from(input), private_key));

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`jeton OAuth2 refusé : ${r.status} ${JSON.stringify(j)}`);
  return j.access_token;
}

/**
 * @param {string} serviceAccountJson Contenu du secret PLAY_SERVICE_ACCOUNT_JSON.
 * @returns Client `{ call, upload }` sur androidpublisher v3.
 */
export async function createPlayClient(serviceAccountJson) {
  const creds = JSON.parse(serviceAccountJson);
  let token = null;
  let mintedAt = 0;

  const bearer = async () => {
    // Les jetons Google valent 1 h ; on les renouvelle largement avant.
    if (!token || Date.now() - mintedAt > 45 * 60_000) {
      token = await mintToken(creds);
      mintedAt = Date.now();
    }
    return token;
  };

  const request = async (url, { method = 'GET', body, contentType = 'application/json' } = {}) => {
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await bearer()}`, 'Content-Type': contentType },
      body: body === undefined ? undefined : (contentType === 'application/json' ? JSON.stringify(body) : body),
    });
    const text = await r.text();
    const j = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(`${method} ${url.replace(API, '').replace(UPLOAD, '')} → ${r.status} ${JSON.stringify(j.error ?? j)}`);
    return j;
  };

  return {
    /** Appel REST sur /androidpublisher/v3 (chemin relatif, ex. `/applications/…`). */
    call: (path, opts) => request(API + path, opts),
    /** Envoi binaire sur l'hôte d'upload (AAB). */
    upload: (path, buffer, contentType) =>
      request(`${UPLOAD}${path}${path.includes('?') ? '&' : '?'}uploadType=media`, {
        method: 'POST', body: buffer, contentType,
      }),
    email: creds.client_email,
  };
}
