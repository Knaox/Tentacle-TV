// La soumission Microsoft Store : fiche publique ou vol de paquet, mêmes
// étapes, routes et champs différents. Les clones ont la forme de ceux que
// renvoie l'API (champs inconnus gardés tels quels : le PUT remplace tout).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareSubmission, submissionTarget } from '../lib/msstore-submission.mjs';

const publicClone = () => ({
  id: '1152921504621243680',
  applicationPackages: [{ id: 'old', fileName: 'TentacleServer.msix', fileStatus: 'None' }],
  listings: {
    'fr-fr': { baseListing: { description: 'garde', releaseNotes: '' } },
    'en-us': { baseListing: { description: 'kept', releaseNotes: '' } },
  },
  pricing: { trialPeriod: 'NoFreeTrial' },
  targetPublishMode: 'Manual',
});

const flightClone = () => ({
  id: '1152921504621243700',
  flightPackages: [{ id: 'old', fileName: 'TentacleServer.msix', fileStatus: 'None' }],
  packageDeliveryOptions: { isMandatoryUpdate: false },
  targetPublishMode: 'Manual',
});

test('sans vol : la fiche publique, ses paquets et ses notes', () => {
  const target = submissionTarget();
  assert.equal(target.path, '');
  assert.equal(target.pendingKey, 'pendingApplicationSubmission');
  assert.equal(target.packagesKey, 'applicationPackages');
  assert.equal(target.notes, true);
  assert.deepEqual(submissionTarget({ flightId: '' }), target);
});

test('avec un vol : les mêmes étapes sous /flights/<id>, sans notes', () => {
  const target = submissionTarget({ flightId: '43e448df-97c9-4a43-a0bc-2a445e736bcd' });
  assert.equal(target.path, '/flights/43e448df-97c9-4a43-a0bc-2a445e736bcd');
  assert.equal(target.pendingKey, 'pendingFlightSubmission');
  assert.equal(target.packagesKey, 'flightPackages');
  assert.equal(target.notes, false);
});

test('fiche publique : notes posées, ancien paquet retiré, nouveau en attente, le reste intact', () => {
  const sub = publicClone();
  const log = prepareSubmission(sub, submissionTarget(), {
    notes: { fr: '• Nouveau', en: '• New' }, packageFileName: 'TentacleServer.msix',
  });
  assert.equal(sub.listings['fr-fr'].baseListing.releaseNotes, '• Nouveau');
  assert.equal(sub.listings['en-us'].baseListing.releaseNotes, '• New');
  assert.equal(sub.listings['fr-fr'].baseListing.description, 'garde');
  assert.deepEqual(sub.pricing, { trialPeriod: 'NoFreeTrial' });
  assert.deepEqual(sub.applicationPackages.map((p) => p.fileStatus), ['PendingDelete', 'PendingUpload']);
  assert.equal(sub.targetPublishMode, 'Immediate');
  assert.ok(log.every((l) => l.level === 'info'));
});

test('fiche publique sans bloc de notes : on publie, et le journal le dit', () => {
  const sub = publicClone();
  const log = prepareSubmission(sub, submissionTarget(), { notes: null, packageFileName: 'TentacleServer.msix' });
  assert.ok(log.some((l) => l.level === 'warn' && /SANS « Nouveautés »/.test(l.text)));
  assert.equal(sub.listings['fr-fr'].baseListing.releaseNotes, '');
});

test('vol : les paquets du vol changent, aucune fiche n\'est inventée', () => {
  const sub = flightClone();
  const log = prepareSubmission(sub, submissionTarget({ flightId: 'abc' }), {
    notes: { fr: 'ignoré', en: 'ignored' }, packageFileName: 'TentacleServer.msix',
  });
  assert.equal(sub.listings, undefined);
  assert.equal(sub.applicationPackages, undefined);
  assert.deepEqual(sub.flightPackages.map((p) => p.fileStatus), ['PendingDelete', 'PendingUpload']);
  assert.deepEqual(sub.packageDeliveryOptions, { isMandatoryUpdate: false });
  assert.equal(sub.targetPublishMode, 'Immediate');
  assert.match(log[0].text, /pas de fiche/);
});

test('un clone sans paquet reçoit le sien', () => {
  const sub = { id: '1' };
  prepareSubmission(sub, submissionTarget({ flightId: 'abc' }), { notes: null, packageFileName: 'x.msix' });
  assert.deepEqual(sub.flightPackages, [{ fileName: 'x.msix', fileStatus: 'PendingUpload' }]);
});
