// Le modèle des annonces Discord : quoi annoncer, et un message qui se relit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DESCRIPTION_MAX, PRODUCTS, STORES, buildAnnouncement, discordNotes, footerText, mergeStores,
  parseAnnouncement, storesServing, targetVersion,
} from '../lib/announce-model.mjs';

const desktop = PRODUCTS.desktop;
const mobile = PRODUCTS.mobile;

test('seuils : rien au niveau du seuil ni en dessous', () => {
  const live = { macos: '1.24.0', windows: '1.24.0', linux: '1.24.0' };
  assert.equal(targetVersion(desktop, live, { macos: '1.24.0', windows: '1.24.0', linux: '1.24.0' }), null);
  assert.equal(targetVersion(desktop, live, { macos: '1.23.0', windows: '1.24.0', linux: '1.24.0' }), '1.24.0');
});

test('seuils par boutique : Play qui rattrape une version déjà en ligne sur iOS l’annonce', () => {
  const floors = { ios: '1.9.0', android: '1.8.1' };
  assert.equal(targetVersion(mobile, { ios: '1.9.0', android: '1.8.1' }, floors), null);
  const live = { ios: '1.9.0', android: '1.9.0' };
  assert.equal(targetVersion(mobile, live, floors), '1.9.0');
  assert.deepEqual(storesServing(mobile, live, '1.9.0'), ['ios', 'android'], 'iOS figure, il la sert aussi');
});

test('la plus haute version neuve gagne ; une boutique inconnue (null) ne compte pas', () => {
  const live = { macos: '1.25.0', windows: '1.24.1', linux: null };
  assert.equal(targetVersion(desktop, live, {}), '1.25.0');
  assert.deepEqual(storesServing(desktop, live, '1.25.0'), ['macos']);
  assert.equal(targetVersion(desktop, { macos: 'pas une version' }, {}), null);
});

test('message : titre, boutiques, pied lisible, et aucune mention possible', () => {
  const msg = buildAnnouncement({
    productKey: 'desktop', version: '1.25.0', stores: ['macos', 'linux'], lang: 'fr',
    notesMd: '- **Nouveau** : @everyone regarde\n  - détail', timestamp: '2026-09-29T00:00:00.000Z',
  });
  const embed = msg.embeds[0];
  assert.equal(embed.title, '🖥️ Tentacle TV pour ordinateur 1.25.0');
  assert.equal(embed.fields[0].name, 'Disponible sur');
  assert.equal(embed.fields[0].value, '🍎 Mac App Store\n🐧 Linux');
  assert.equal(embed.footer.text, footerText('desktop', '1.25.0'));
  assert.equal(embed.description, '• **Nouveau** : @everyone regarde\n  ◦ détail');
  assert.deepEqual(msg.allowed_mentions, { parse: [] }, '@everyone dans un changelog ne pingue personne');
  const buttons = msg.components[0].components;
  assert.deepEqual(buttons.map((b) => b.label), ['Mac App Store', 'Linux']);
  assert.ok(buttons.every((b) => b.style === 5 && b.url.startsWith('https://')));
  assert.equal(buttons[1].url, 'https://github.com/Knaox/Tentacle-TV/releases/tag/desktop-v1.25.0');
});

test('message relu : le pied et les boutons rendent plateforme, version et boutiques', () => {
  const msg = buildAnnouncement({ productKey: 'tv', version: '1.4.0', stores: ['androidtv'], lang: 'en', notesMd: 'x' });
  assert.deepEqual(parseAnnouncement(msg), { productKey: 'tv', version: '1.4.0', stores: ['androidtv'], timestamp: null });
  assert.equal(parseAnnouncement({ embeds: [{ footer: { text: 'autre chose' } }] }), null);
  assert.equal(parseAnnouncement({ content: 'message d’un humain' }), null);
  assert.equal(parseAnnouncement({ embeds: [{ footer: { text: 'Tentacle TV · inconnu 1.0.0' } }] }), null);
});

test('enrichir : union dans l’ordre du modèle, sans doublon', () => {
  assert.deepEqual(mergeStores('desktop', ['linux'], ['windows', 'linux']), ['windows', 'linux']);
  assert.deepEqual(mergeStores('mobile', [], ['android']), ['android']);
});

test('notes longues : coupées à une ligne entière, sous la limite, avec le lien vers la suite', () => {
  const md = Array.from({ length: 400 }, (_, i) => `- **Point ${i}** : une ligne de notes assez longue`).join('\n');
  const text = discordNotes(md, 'https://example.test/notes', 'en');
  assert.ok(text.length <= DESCRIPTION_MAX);
  assert.ok(text.endsWith('\n…\n[Full release notes](https://example.test/notes)'));
  assert.ok(/• \*\*Point \d+\*\* : une ligne de notes assez longue\n…/.test(text), 'la dernière puce est entière');
  assert.equal(discordNotes(null, 'u', 'fr'), 'Notes de version sur GitHub.');
});

test('libellés de boutons uniques dans chaque plateforme (ils servent à relire)', () => {
  for (const [key, product] of Object.entries(PRODUCTS)) {
    const labels = product.stores.map((s) => STORES[s].label);
    assert.equal(new Set(labels).size, labels.length, key);
  }
});
