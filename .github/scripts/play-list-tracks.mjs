// Liste les PISTES Play (identifiants API exacts) d'une app et leurs releases.
//
//   PLAY_SERVICE_ACCOUNT_JSON=… node .github/scripts/play-list-tracks.mjs [paquet]
//
// Joué par .github/workflows/play-tracks.yml. Remplace un `npm install
// googleapis` sans lockfile ni --ignore-scripts, la seule installation non
// figée de la CI (2026-10-22) : même client maison que la publication
// (lib/play-api.mjs), zéro dépendance npm.
import { pathToFileURL } from 'node:url';
import { createPlayClient } from './lib/play-api.mjs';

/** Une ligne lisible par piste, comme le faisait l'ancien script. */
export function describeTrack(track) {
  const releases = (track.releases ?? [])
    .map((r) => `${r.status}${r.name ? ` « ${r.name} »` : ''} [vc ${(r.versionCodes ?? []).join(', ') || '—'}]`)
    .join(' ; ');
  return `  • track API = "${track.track}" → ${releases || '(aucune release)'}`;
}

async function main(packageName) {
  const json = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('PLAY_SERVICE_ACCOUNT_JSON absent');
  const play = await createPlayClient(json);
  const base = `/applications/${encodeURIComponent(packageName)}/edits`;
  const edit = await play.call(base, { method: 'POST', body: {} });
  try {
    const { tracks } = await play.call(`${base}/${edit.id}/tracks`);
    console.log(`Pistes de ${packageName} :`);
    for (const track of tracks ?? []) console.log(describeTrack(track));
  } finally {
    // Édition de lecture seule : on la jette, quoi qu'il arrive.
    await play.call(`${base}/${edit.id}`, { method: 'DELETE' }).catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv[2] ?? 'com.tentacletv.mobile').catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
