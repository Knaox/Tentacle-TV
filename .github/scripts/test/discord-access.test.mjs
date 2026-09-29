// Les droits du bot Discord dans un salon, calculés comme Discord les calcule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PERMISSIONS, effectivePermissions, missingPermissions } from '../lib/discord.mjs';

// Les droits du bot : un serveur factice avec les mêmes formes que l'API.
const GUILD = '100';
const BOT = '200';
const BOT_ROLE = '300';
const bits = (...names) => String(names.reduce((acc, n) => acc | PERMISSIONS[n], 0n));
const roles = (botRolePerms) => [
  { id: GUILD, permissions: bits('VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY') },
  { id: BOT_ROLE, permissions: botRolePerms },
];
const LANG_GATED = [{ id: GUILD, type: 0, allow: '0', deny: bits('VIEW_CHANNEL', 'SEND_MESSAGES') }];
const BOT_OVERWRITE = { id: BOT, type: 1, allow: bits('VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY'), deny: '0' };

const access = (botRolePerms, overwrites) =>
  effectivePermissions({ guildId: GUILD, roles: roles(botRolePerms), memberRoleIds: [BOT_ROLE], userId: BOT, overwrites });

test('droits : administrateur, le bot peut tout', () => {
  const a = access(bits('ADMINISTRATOR'), LANG_GATED);
  assert.equal(a.admin, true);
  assert.deepEqual(missingPermissions(a), []);
});

test('droits : sans administrateur, sa dérogation dans le salon suffit', () => {
  const a = access('0', [...LANG_GATED, BOT_OVERWRITE]);
  assert.equal(a.admin, false);
  assert.deepEqual(missingPermissions(a), []);
});

test('droits : sans administrateur ni dérogation, un salon réservé lui est fermé', () => {
  assert.deepEqual(missingPermissions(access('0', LANG_GATED)), ['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS']);
  const denied = { ...BOT_OVERWRITE, allow: '0', deny: bits('SEND_MESSAGES') };
  assert.deepEqual(missingPermissions(access(bits('EMBED_LINKS'), [denied])), ['SEND_MESSAGES'], 'une dérogation du membre passe en dernier');
});
