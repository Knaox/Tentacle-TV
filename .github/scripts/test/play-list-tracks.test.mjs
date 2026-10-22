// Mise en forme des pistes Play (play-list-tracks.mjs), hors ligne.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeTrack } from '../play-list-tracks.mjs';

test('une piste avec releases nommées', () => {
  const line = describeTrack({ track: 'tv:internal', releases: [{ status: 'completed', name: '1.20.0', versionCodes: ['2000001'] }] });
  assert.equal(line, '  • track API = "tv:internal" → completed « 1.20.0 » [vc 2000001]');
});

test('une piste vide', () => {
  assert.equal(describeTrack({ track: 'beta' }), '  • track API = "beta" → (aucune release)');
});
