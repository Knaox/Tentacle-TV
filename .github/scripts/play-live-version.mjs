// La version RÉELLEMENT servie par une piste Play, sur stdout et rien d'autre.
//
//   node .github/scripts/play-live-version.mjs --package <id> --track <piste>
//
// Sert au veilleur (store-watch.yml) : depuis que play-publish.mjs pose les
// releases en « completed », « publié » est déductible — mais une promotion
// faite à la main dans la console, ou un examen Google qui traîne, peuvent
// encore désynchroniser le manifeste. Ce script le rattrape.
//
// stdout : le nom de la release (que play-publish pose à la version marketing).
// stderr : le diagnostic. Exit 1 si la piste ne sert rien.
import { createPlayClient } from './lib/play-api.mjs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const pkg = flag('package');
const track = flag('track');

if (!pkg || !track || !process.env.PLAY_SERVICE_ACCOUNT_JSON) {
  console.error('usage : play-live-version.mjs --package <id> --track <piste> (PLAY_SERVICE_ACCOUNT_JSON requis)');
  process.exit(1);
}

const play = await createPlayClient(process.env.PLAY_SERVICE_ACCOUNT_JSON);
const base = `/applications/${pkg}`;
const edit = await play.call(`${base}/edits`, { method: 'POST', body: {} });

try {
  const data = await play.call(`${base}/edits/${edit.id}/tracks/${encodeURIComponent(track)}`);
  const served = (data.releases ?? []).filter((r) => ['completed', 'inProgress'].includes(r.status));
  console.error(`pistes servies : ${served.map((r) => `${r.name ?? '?'} (${r.status})`).join(', ') || 'aucune'}`);
  const name = served.at(-1)?.name;
  if (!name) {
    console.error(`::error::la piste « ${track} » ne sert aucune release.`);
    process.exit(1);
  }
  process.stdout.write(String(name));
} finally {
  // L'édition n'est JAMAIS commitée : c'est une lecture.
  await play.call(`${base}/edits/${edit.id}`, { method: 'DELETE' }).catch(() => {});
}
