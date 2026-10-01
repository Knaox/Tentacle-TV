// La version App Store d'une livraison : trouvée, renommée ou créée — jamais
// une seconde version modifiable, jamais une version soumise ou en vente.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EDITABLE_VERSION_STATES, ensureAppStoreVersion, versionState } from '../lib/asc-api.mjs';

const APP = 'app-1';

const version = (id, platform, versionString, state, field = 'appVersionState') =>
  ({ id, type: 'appStoreVersions', attributes: { platform, versionString, [field]: state } });

/**
 * Un faux App Store Connect : les versions d'une app, le journal des appels, et
 * la règle qui a fait échouer la 1.25.3 macOS — une seule version modifiable
 * par plateforme, sinon 409 à la création.
 */
function fakeAsc(versions) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    const url = new URL(path, 'https://asc.example');
    if (method === 'GET' && url.pathname === `/v1/apps/${APP}/appStoreVersions`) {
      const wanted = url.searchParams.get('filter[versionString]');
      const platform = url.searchParams.get('filter[platform]');
      const found = versions.filter((v) => v.attributes.platform === platform
        && (!wanted || v.attributes.versionString === wanted));
      return { data: wanted ? found.slice(0, 1) : found };
    }
    if (method === 'PATCH' && url.pathname.startsWith('/v1/appStoreVersions/')) {
      const target = versions.find((v) => v.id === body.data.id);
      Object.assign(target.attributes, body.data.attributes);
      return { data: target };
    }
    if (method === 'POST' && url.pathname === '/v1/appStoreVersions') {
      const { platform, versionString } = body.data.attributes;
      const open = versions.some((v) => v.attributes.platform === platform && EDITABLE_VERSION_STATES.has(versionState(v)));
      if (open) throw new Error('POST /v1/appStoreVersions → 409 You cannot create a new version of the App in the current state.');
      const created = version(`v${versions.length + 1}`, platform, versionString, 'PREPARE_FOR_SUBMISSION');
      versions.push(created);
      return { data: created };
    }
    throw new Error(`appel inattendu : ${method} ${path}`);
  };
  const writes = () => calls.filter((c) => c.method !== 'GET');
  return { api, calls, writes };
}

const quiet = () => {};

test('la version qui porte déjà le numéro est reprise telle quelle, sans écriture', async () => {
  const { api, writes } = fakeAsc([version('v1', 'MAC_OS', '1.25.3', 'READY_FOR_REVIEW')]);
  const ver = await ensureAppStoreVersion(api, APP, { version: '1.25.3', platform: 'MAC_OS' }, quiet);
  assert.equal(ver.id, 'v1');
  assert.deepEqual(writes(), []);
});

test('la version en préparation d\'un numéro plus ancien est RENOMMÉE, pas doublée — le 409 du 2026-10-01', async () => {
  const versions = [
    version('v25', 'MAC_OS', '1.25.0', 'READY_FOR_DISTRIBUTION'),
    version('v252', 'MAC_OS', '1.25.2', 'PREPARE_FOR_SUBMISSION'),
    version('ios', 'IOS', '1.10.1', 'PREPARE_FOR_SUBMISSION'),
  ];
  const { api, writes } = fakeAsc(versions);
  const lines = [];
  const ver = await ensureAppStoreVersion(api, APP, { version: '1.25.3', platform: 'MAC_OS' }, (m) => lines.push(m));

  assert.equal(ver.id, 'v252');
  assert.equal(ver.attributes.versionString, '1.25.3');
  assert.deepEqual(writes().map((c) => `${c.method} ${c.path}`), ['PATCH /v1/appStoreVersions/v252']);
  assert.deepEqual(writes()[0].body.data.attributes, { versionString: '1.25.3' });
  assert.match(lines.join('\n'), /\[asc\] version 1\.25\.2 renommée 1\.25\.3 \(MAC_OS\)/);
  // Ni la version en vente ni celle d'une autre plateforme ne bougent.
  assert.equal(versions[0].attributes.versionString, '1.25.0');
  assert.equal(versions[2].attributes.versionString, '1.10.1');
});

test('l\'ancien vocabulaire (appStoreState) désigne aussi la version à renommer', async () => {
  const { api, writes } = fakeAsc([version('v252', 'MAC_OS', '1.25.2', 'REJECTED', 'appStoreState')]);
  const ver = await ensureAppStoreVersion(api, APP, { version: '1.25.3', platform: 'MAC_OS' }, quiet);
  assert.equal(ver.attributes.versionString, '1.25.3');
  assert.equal(writes().length, 1);
});

test('une version soumise ou en vente n\'est jamais touchée : la suivante est créée', async () => {
  const versions = [
    version('v24', 'MAC_OS', '1.24.0', 'READY_FOR_SALE', 'appStoreState'),
    version('v25', 'MAC_OS', '1.25.0', 'READY_FOR_DISTRIBUTION'),
    version('v252', 'MAC_OS', '1.25.2', 'WAITING_FOR_REVIEW'),
  ];
  const { api, writes } = fakeAsc(versions);
  const lines = [];
  const ver = await ensureAppStoreVersion(api, APP, { version: '1.25.3', platform: 'MAC_OS' }, (m) => lines.push(m));

  assert.equal(ver.attributes.versionString, '1.25.3');
  assert.deepEqual(writes().map((c) => c.method), ['POST']);
  assert.deepEqual(versions.slice(0, 3).map((v) => v.attributes.versionString), ['1.24.0', '1.25.0', '1.25.2']);
  assert.match(lines.join('\n'), /création de la version App Store 1\.25\.3 \(MAC_OS\)/);
});

test('une version en préparation PLUS RÉCENTE n\'est ni renommée ni doublée', async () => {
  const { api, writes } = fakeAsc([version('v26', 'MAC_OS', '1.26.0', 'PREPARE_FOR_SUBMISSION')]);
  await assert.rejects(
    ensureAppStoreVersion(api, APP, { version: '1.25.3', platform: 'MAC_OS' }, quiet),
    /1\.26\.0 \(MAC_OS\) est en préparation, plus récente que 1\.25\.3/,
  );
  assert.deepEqual(writes(), []);
});

test('deux versions modifiables à la fois : on refuse de choisir', async () => {
  const { api, writes } = fakeAsc([
    version('a', 'TV_OS', '1.9.0', 'PREPARE_FOR_SUBMISSION'),
    version('b', 'TV_OS', '1.9.1', 'DEVELOPER_REJECTED'),
  ]);
  await assert.rejects(
    ensureAppStoreVersion(api, APP, { version: '1.10.0', platform: 'TV_OS' }, quiet),
    /2 versions modifiables \(TV_OS\) : 1\.9\.0, 1\.9\.1/,
  );
  assert.deepEqual(writes(), []);
});
