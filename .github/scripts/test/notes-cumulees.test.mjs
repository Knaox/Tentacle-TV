// Notes cumulées : une boutique en retard reçoit aussi les nouveautés des
// versions qu'elle n'a jamais servies — sans retoucher le moindre changelog.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { extractCumulative, loadNotes, notesVersions } from '../lib/changelog.mjs';
import { manifestEntry, manifestVersion } from '../lib/published.mjs';

const MD = [
  '## [1.28.1]', '### FR', '- Quitter une vidéo l’arrête', '### EN', '- Leaving a video stops it', '',
  '## [win-1.28.0]', '### FR', '- Windows seulement', '### EN', '- Windows only', '',
  '## [1.28.0]', '### FR', '- Fiche sans métadonnées ✓', '### EN', '- Page without metadata ✓', '',
  '## [mac-1.27.0]', '### FR', '- Mac seulement', '### EN', '- Mac only', '',
  '## [1.27.0]', '### FR', '- Assistant repensé', '### EN', '- Redesigned wizard', '',
  '## [1.26.0]', '### FR', '- Déjà servie', '### EN', '- Already served', '',
].join('\n');

const tmpFile = (name, content) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'notes-')), name);
  writeFileSync(file, content);
  return file;
};

test('versions : la livrée, puis les sautées strictement au-dessus de la servie', () => {
  assert.deepEqual(notesVersions(MD, { version: '1.28.1', since: '1.26.0' }), ['1.28.1', '1.28.0', '1.27.0']);
  // Servie inconnue, égale ou plus récente : la seule version (rejeu, retour en arrière).
  assert.deepEqual(notesVersions(MD, { version: '1.28.1', since: null }), ['1.28.1']);
  assert.deepEqual(notesVersions(MD, { version: '1.28.1', since: '1.28.1' }), ['1.28.1']);
  assert.deepEqual(notesVersions(MD, { version: '1.27.0', since: '1.28.0' }), ['1.27.0']);
  assert.deepEqual(notesVersions(MD, { version: '1.28.1', since: 'n/a' }), ['1.28.1']);
});

test('cumul : du plus récent au plus ancien, le bloc du canal remplace le nu', () => {
  const mac = extractCumulative(MD, { channel: 'mac', version: '1.28.1', since: '1.26.0' });
  assert.deepEqual(mac.versions, ['1.28.1', '1.28.0', '1.27.0']);
  assert.equal(mac.fr, '- Quitter une vidéo l’arrête\n- Fiche sans métadonnées ✓\n- Mac seulement');
  assert.ok(mac.raw.startsWith('### FR\n\n- Quitter'), 'GitHub : tout le français, puis tout l’anglais');
  assert.ok(mac.raw.includes('### EN\n\n- Leaving a video stops it\n- Page without metadata ✓\n- Mac only'));

  const win = extractCumulative(MD, { channel: 'win', version: '1.28.1', since: '1.26.0' });
  assert.equal(win.fr, '- Quitter une vidéo l’arrête\n- Windows seulement\n- Assistant repensé');
});

test('cumul : le bloc de la version livrée reste exigé', () => {
  assert.equal(extractCumulative(MD, { version: '1.29.0', since: '1.26.0' }), null);
});

test('rien de sauté : exactement la section d’avant', () => {
  const one = extractCumulative(MD, { version: '1.28.1', since: '1.28.0' });
  assert.deepEqual(one.versions, ['1.28.1']);
  assert.equal(one.fr, '- Quitter une vidéo l’arrête');
});

test('stores : la coupe garde la livrée en tête, Apple ne reçoit jamais « ✓ »', () => {
  const changelog = tmpFile('desktop.md', MD);
  const asc = loadNotes({ changelog, channel: 'mac', version: '1.28.1', since: '1.26.0', format: 'asc' });
  assert.equal(asc.fr, '• Quitter une vidéo l’arrête\n• Fiche sans métadonnées\n• Mac seulement');
  assert.ok(!asc.en.includes('✓'));
  const github = loadNotes({ changelog, version: '1.28.1', since: '1.26.0', format: 'github' });
  assert.ok(github.raw.includes('✓'), 'GitHub garde le texte tel quel');

  const long = tmpFile('mobile.md', [
    '## [2.0.0]', '### FR', `- ${'a'.repeat(300)}`, '### EN', `- ${'b'.repeat(300)}`, '',
    '## [1.9.0]', '### FR', `- ${'c'.repeat(300)}`, '### EN', `- ${'d'.repeat(300)}`, '',
  ].join('\n'));
  const play = loadNotes({ changelog: long, version: '2.0.0', since: '1.8.0', format: 'play' });
  assert.ok(play.fr.length <= 500 && play.fr.startsWith('• aaa'), 'Play : la livrée tient, la sautée est coupée');
});

test('manifeste : la version servie par bloc, null si illisible', () => {
  const file = tmpFile('store-versions.json', JSON.stringify({
    macAppStore: { version: '1.25.3', notes: { en: 'x' } }, microsoftStore: { version: 'oups' },
  }));
  assert.equal(manifestVersion('mac', file), '1.25.3');
  assert.equal(manifestEntry('mac', file).notes.en, 'x');
  assert.equal(manifestVersion('win', file), null);
  assert.equal(manifestVersion('linux', file), null);
  assert.equal(manifestVersion('inconnu', file), null);
  assert.equal(manifestVersion('mac', '/nulle/part.json'), null);
});
