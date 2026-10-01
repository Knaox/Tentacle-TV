// Lecture d'un registre d'images OCI (ghcr.io) : l'empreinte d'une étiquette,
// et les labels de l'image qu'elle désigne. LECTURE SEULE, zéro dépendance.
//
// POURQUOI PAS `docker buildx imagetools inspect`. Le même code tourne en CI et
// sur une machine sans buildx, et se rejoue hors ligne dans les tests (le
// `fetch` s'injecte). Le protocole est celui de la spécification OCI
// « distribution » : un défi `WWW-Authenticate`, un jeton, le manifeste, puis
// le blob de configuration, qui porte les labels.
//
// L'EMPREINTE RENDUE est celle de ce que désigne l'étiquette — l'INDEX
// multi-architecture pour nos images. C'est elle qu'on épingle dans
// `docker-image://…@sha256:…` : BuildKit y choisit lui-même la plateforme du
// build, et deux jobs (amd64, arm64) lisent ainsi la même image même si
// l'étiquette bouge entre-temps.
import { createHash } from 'node:crypto';

const MANIFEST_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** La plateforme dont on lit les labels : toutes les nôtres portent les mêmes. */
const LABEL_PLATFORM = { os: 'linux', architecture: 'amd64' };

const TIMEOUT_MS = 20_000;

/** `ghcr.io/knaox/tentacle-tv:latest` ou `…@sha256:…` → ses trois morceaux. */
export function parseImageRef(ref) {
  const m = String(ref).match(/^([^/\s]+)\/([a-z0-9._/-]+?)(?::([\w][\w.-]{0,127}))?(?:@(sha256:[0-9a-f]{64}))?$/);
  if (!m || (!m[3] && !m[4])) throw new Error(`référence d'image illisible : « ${ref} »`);
  return { host: m[1], repo: m[2], reference: m[4] ?? m[3] };
}

/** `Bearer realm="…",service="…",scope="…"` → { realm, service, scope }. */
export function parseChallenge(header) {
  const params = {};
  for (const [, key, value] of String(header ?? '').matchAll(/(\w+)="([^"]*)"/g)) params[key] = value;
  return params;
}

/**
 * Un client de lecture. `username`/`password` (facultatifs) ne servent qu'à
 * obtenir le jeton : une image publique se lit sans eux.
 */
export function createRegistryClient({ fetch = globalThis.fetch, username, password } = {}) {
  const tokens = new Map();

  async function getToken(challenge) {
    const key = `${challenge.realm}|${challenge.service}|${challenge.scope}`;
    if (tokens.has(key)) return tokens.get(key);
    const url = new URL(challenge.realm);
    if (challenge.service) url.searchParams.set('service', challenge.service);
    if (challenge.scope) url.searchParams.set('scope', challenge.scope);
    const ask = (headers) => fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    let res = username && password
      ? await ask({ Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` })
      : await ask({});
    // Des identifiants refusés ne doivent pas bloquer une image PUBLIQUE : on
    // retente sans eux. Si l'image est privée, le refus tombera plus loin.
    if (!res.ok && username && password) res = await ask({});
    if (!res.ok) throw new Error(`jeton du registre refusé (${res.status})`);
    const body = await res.json();
    const token = body.token ?? body.access_token;
    if (!token) throw new Error('le registre n\'a pas rendu de jeton');
    tokens.set(key, token);
    return token;
  }

  /**
   * GET avec le défi d'authentification et les redirections suivis à la main :
   * un blob de ghcr.io redirige vers un CDN à URL signée, qui refuse — ou
   * recevrait sans raison — l'en-tête Authorization du registre.
   */
  async function get(url, accept) {
    let auth = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = { Accept: accept };
      if (auth) headers.Authorization = `Bearer ${auth}`;
      const res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 401 && !auth) {
        const challenge = parseChallenge(res.headers.get('www-authenticate'));
        if (!challenge.realm) throw new Error(`401 sans défi d'authentification sur ${url}`);
        auth = await getToken(challenge);
        continue;
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location'), url);
        return fetch(next, { headers: { Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      }
      return res;
    }
    throw new Error(`accès refusé par le registre sur ${url}`);
  }

  /** Le manifeste désigné par `reference`, ou null si le registre ne le connaît pas. */
  async function manifest({ host, repo }, reference) {
    const res = await get(`https://${host}/v2/${repo}/manifests/${reference}`, MANIFEST_TYPES);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`manifeste ${repo}:${reference} → ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    const digest = res.headers.get('docker-content-digest')
      ?? `sha256:${createHash('sha256').update(raw).digest('hex')}`;
    return { digest, body: JSON.parse(raw.toString('utf8')) };
  }

  /** L'empreinte que désigne `ref`, ou null si l'image n'existe pas. */
  async function resolve(ref) {
    const parsed = parseImageRef(ref);
    const found = await manifest(parsed, parsed.reference);
    return found ? found.digest : null;
  }

  /**
   * { digest, labels, platforms } de l'image `ref`, ou null si elle n'existe
   * pas. Les labels sont ceux de la plateforme linux/amd64 d'un index.
   */
  async function inspect(ref) {
    const parsed = parseImageRef(ref);
    const top = await manifest(parsed, parsed.reference);
    if (!top) return null;

    let configDigest = top.body.config?.digest ?? null;
    let platforms = [];
    if (Array.isArray(top.body.manifests)) {
      // Les attestations de buildx se glissent dans l'index sous
      // « unknown/unknown » : ce ne sont pas des images.
      const images = top.body.manifests.filter((m) => m.platform && m.platform.os !== 'unknown');
      platforms = images.map((m) => `${m.platform.os}/${m.platform.architecture}`);
      const chosen = images.find((m) => m.platform.os === LABEL_PLATFORM.os
        && m.platform.architecture === LABEL_PLATFORM.architecture) ?? images[0];
      if (!chosen) throw new Error(`index ${ref} sans aucune image`);
      const sub = await manifest(parsed, chosen.digest);
      if (!sub) throw new Error(`manifeste ${chosen.digest} introuvable dans ${ref}`);
      configDigest = sub.body.config?.digest ?? null;
    }
    if (!configDigest) throw new Error(`manifeste ${ref} sans configuration`);

    const res = await get(`https://${parsed.host}/v2/${parsed.repo}/blobs/${configDigest}`, 'application/json, */*');
    if (!res.ok) throw new Error(`configuration ${configDigest} → ${res.status}`);
    const config = await res.json();
    return { digest: top.digest, labels: config.config?.Labels ?? {}, platforms };
  }

  return { resolve, inspect };
}
