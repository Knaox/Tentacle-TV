// La lecture du registre, contre un faux ghcr.io : défi d'authentification,
// index multi-architecture, attestations, blob redirigé vers un CDN.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRegistryClient, parseChallenge, parseImageRef } from '../lib/registry.mjs';

const INDEX = `sha256:${'a'.repeat(64)}`;
const AMD64 = `sha256:${'b'.repeat(64)}`;
const ARM64 = `sha256:${'c'.repeat(64)}`;
const ATTEST = `sha256:${'d'.repeat(64)}`;
const CONFIG = `sha256:${'e'.repeat(64)}`;
const TOKEN = 'jeton-anonyme';

const json = (body, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Un faux ghcr.io : `latest` est un index, `seul` un manifeste simple. */
function fakeGhcr({ labels = { 'org.opencontainers.image.version': '1.22.0' } } = {}) {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const auth = init.headers?.Authorization ?? null;
    calls.push({ url: url.href, auth });

    if (url.host === 'ghcr.io' && url.pathname === '/token') {
      return json({ token: TOKEN });
    }
    if (url.host === 'cdn.example') {
      return json({ config: { Labels: labels } });
    }
    if (auth !== `Bearer ${TOKEN}`) {
      return new Response('', {
        status: 401,
        headers: { 'www-authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:knaox/tentacle-tv:pull"' },
      });
    }
    const path = url.pathname.replace('/v2/knaox/tentacle-tv/', '');
    if (path === 'manifests/latest') {
      return json({
        mediaType: 'application/vnd.oci.image.index.v1+json',
        manifests: [
          { digest: ATTEST, platform: { os: 'unknown', architecture: 'unknown' } },
          { digest: ARM64, platform: { os: 'linux', architecture: 'arm64' } },
          { digest: AMD64, platform: { os: 'linux', architecture: 'amd64' } },
        ],
      }, { headers: { 'docker-content-digest': INDEX } });
    }
    if (path === `manifests/${AMD64}` || path === 'manifests/seul') {
      return json({ config: { digest: CONFIG } }, { headers: { 'docker-content-digest': AMD64 } });
    }
    if (path === `blobs/${CONFIG}`) {
      return new Response('', { status: 307, headers: { location: 'https://cdn.example/blob?signature=x' } });
    }
    return new Response('{"errors":[{"code":"MANIFEST_UNKNOWN"}]}', { status: 404 });
  };
  return { fetch, calls };
}

test('référence d\'image : étiquette ou empreinte, jamais les deux absentes', () => {
  assert.deepEqual(parseImageRef('ghcr.io/knaox/tentacle-tv:v1.22.0-webos-1.1.0'),
    { host: 'ghcr.io', repo: 'knaox/tentacle-tv', reference: 'v1.22.0-webos-1.1.0' });
  assert.deepEqual(parseImageRef(`ghcr.io/knaox/tentacle-tv@${INDEX}`),
    { host: 'ghcr.io', repo: 'knaox/tentacle-tv', reference: INDEX });
  assert.throws(() => parseImageRef('ghcr.io/knaox/tentacle-tv'));
  assert.throws(() => parseImageRef('tentacle-tv:latest'));
});

test('défi d\'authentification : realm, service et scope', () => {
  assert.deepEqual(parseChallenge('Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:a/b:pull"'),
    { realm: 'https://ghcr.io/token', service: 'ghcr.io', scope: 'repository:a/b:pull' });
});

test('index : empreinte de l\'index, labels d\'amd64, attestations écartées', async () => {
  const { fetch } = fakeGhcr();
  const client = createRegistryClient({ fetch });
  const found = await client.inspect('ghcr.io/knaox/tentacle-tv:latest');
  assert.equal(found.digest, INDEX, 'on épingle l\'index, pas une plateforme');
  assert.deepEqual(found.platforms, ['linux/arm64', 'linux/amd64']);
  assert.deepEqual(found.labels, { 'org.opencontainers.image.version': '1.22.0' });
  assert.equal(await client.resolve('ghcr.io/knaox/tentacle-tv:latest'), INDEX);
});

test('manifeste simple, et image sans labels', async () => {
  const { fetch } = fakeGhcr({ labels: null });
  const found = await createRegistryClient({ fetch }).inspect('ghcr.io/knaox/tentacle-tv:seul');
  assert.equal(found.digest, AMD64);
  assert.deepEqual(found.labels, {});
});

test('étiquette inconnue : null, pas une erreur', async () => {
  const { fetch } = fakeGhcr();
  const client = createRegistryClient({ fetch });
  assert.equal(await client.inspect('ghcr.io/knaox/tentacle-tv:v9.9.9'), null);
  assert.equal(await client.resolve('ghcr.io/knaox/tentacle-tv:v9.9.9'), null);
});

test('le jeton du registre ne part jamais vers le CDN des blobs', async () => {
  const { fetch, calls } = fakeGhcr();
  await createRegistryClient({ fetch }).inspect('ghcr.io/knaox/tentacle-tv:latest');
  const cdn = calls.filter((c) => c.url.startsWith('https://cdn.example/'));
  assert.equal(cdn.length, 1);
  assert.equal(cdn[0].auth, null);
});

test('identifiants : servent au seul guichet des jetons, en Basic', async () => {
  const { fetch, calls } = fakeGhcr();
  await createRegistryClient({ fetch, username: 'bot', password: 'secret' }).resolve('ghcr.io/knaox/tentacle-tv:latest');
  const tokenCall = calls.find((c) => c.url.startsWith('https://ghcr.io/token'));
  assert.equal(tokenCall.auth, `Basic ${Buffer.from('bot:secret').toString('base64')}`);
  assert.ok(calls.filter((c) => c.url.includes('/v2/')).every((c) => !String(c.auth).startsWith('Basic')));
});

test('une panne du registre est une erreur, jamais « image absente »', async () => {
  const fetch = async () => new Response('', { status: 503 });
  await assert.rejects(createRegistryClient({ fetch }).inspect('ghcr.io/knaox/tentacle-tv:latest'), /503/);
});
