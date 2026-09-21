// Publie sur Google Play — ou promeut d'une piste à l'autre — en UNE édition.
//
//   Envoi :     --package <id> --track alpha --aab <fichier>
//               --changelog changelogs/mobile.md --version 1.8.1
//   Promotion : --package <id> --promote-from alpha --track production
//               --changelog changelogs/mobile.md --version 1.8.1
//   Ajouter --dry-run pour tout jouer SAUF le commit (l'édition est jetée).
//
// POURQUOI PAS r0adkll/upload-google-play. Cette action publiait en
// « status: draft » sur une piste fermée : il restait deux promotions à la
// main dans la console, puis une édition de updates/store-versions.json. Elle
// ne sait pas non plus promouvoir un versionCode déjà en ligne — or passer au
// store DOIT envoyer le binaire déjà testé, pas un rebuild.
//
// CE QU'ON NE TOUCHE PAS. Une seule piste est écrite, celle qui est demandée.
// La fiche, les prix, les captures et les AUTRES pistes ne sont jamais lus en
// écriture. Les notes ne partent que dans les langues réellement présentes
// dans le changelog.
//
// SÉRIALISATION. Android TV et Android mobile partagent la fiche
// com.tentacletv.mobile : deux éditions concurrentes s'invalident l'une
// l'autre. Les workflows posent une `concurrency` de job commune ; ce script
// réessaie tout de même une fois, l'édition étant perdue dès qu'un autre la
// commite.
import fs from 'node:fs';
import { createPlayClient } from './lib/play-api.mjs';
import { loadNotes } from './lib/changelog.mjs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const has = (n) => args.includes(`--${n}`);

const pkg = flag('package');
const track = flag('track');
const aab = flag('aab');
const promoteFrom = flag('promote-from');
const changelog = flag('changelog');
const version = flag('version');
const status = flag('status') ?? 'completed';
const dryRun = has('dry-run');

if (!pkg || !track || !version || (!aab && !promoteFrom)) {
  console.error('usage : play-publish.mjs --package <id> --track <piste> --version <X.Y.Z>');
  console.error('        (--aab <fichier> | --promote-from <piste>) [--changelog <f>] [--status completed|draft] [--dry-run]');
  process.exit(1);
}
if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) {
  console.error('::error::PLAY_SERVICE_ACCOUNT_JSON manquant.');
  process.exit(1);
}

/** Notes fr-FR / en-US, seulement celles qui existent. */
function releaseNotes() {
  if (!changelog) return [];
  const notes = loadNotes({ changelog, version, format: 'play' });
  if (!notes) {
    console.error(`::error::aucun bloc « ## [${version}] » dans ${changelog}.`);
    process.exit(1);
  }
  // `loadNotes` a déjà ramené le texte sous les 500 caractères de Play : y
  // remettre un contrôle de longueur serait du code mort, et deux endroits qui
  // décident de la même limite finissent par se contredire. C'est
  // check-changelog.mjs, au pré-vol, qui dit AVANT le build de combien la
  // coupe va mordre.
  return [['fr-FR', notes.fr], ['en-US', notes.en]]
    .filter(([, text]) => text?.trim())
    .map(([language, text]) => ({ language, text }));
}

/** Le versionCode le plus haut effectivement servi sur une piste. */
function servedVersionCodes(trackData) {
  const usable = (trackData.releases ?? []).filter((r) => ['completed', 'inProgress'].includes(r.status));
  if (usable.length === 0) return null;
  const codes = usable.flatMap((r) => (r.versionCodes ?? []).map(Number)).filter(Number.isFinite);
  return codes.length > 0 ? [String(Math.max(...codes))] : null;
}

async function publish(play) {
  const base = `/applications/${pkg}`;
  const edit = await play.call(`${base}/edits`, { method: 'POST', body: {} });
  const editId = edit.id;
  console.log(`[play] édition ${editId} ouverte (${play.email}).`);

  try {
    let versionCodes;

    if (aab) {
      const bytes = fs.readFileSync(aab);
      console.log(`[play] envoi de ${aab} (${(bytes.length / 1e6).toFixed(1)} Mo)…`);
      const bundle = await play.upload(`${base}/edits/${editId}/bundles`, bytes, 'application/octet-stream');
      versionCodes = [String(bundle.versionCode)];
      console.log(`[play] versionCode ${bundle.versionCode} reçu.`);
    } else {
      const from = await play.call(`${base}/edits/${editId}/tracks/${encodeURIComponent(promoteFrom)}`);
      versionCodes = servedVersionCodes(from);
      if (!versionCodes) {
        console.error(`::error::la piste « ${promoteFrom} » ne sert aucune release (statuts vus : ${(from.releases ?? []).map((r) => r.status).join(', ') || 'aucune'}). Rien à promouvoir.`);
        process.exit(1);
      }
      console.log(`[play] promotion de « ${promoteFrom} » vers « ${track} » : versionCode ${versionCodes.join(', ')}.`);
    }

    // Une piste inconnue donnerait un 404 opaque. Les pistes par form factor
    // sont PRÉFIXÉES dans l'API (« tv:Alpha », « tv:production »), et le
    // préfixe exact ne se devine pas : on le vérifie, et on liste ce qui existe
    // vraiment si la cible n'y est pas.
    const known = ((await play.call(`${base}/edits/${editId}/tracks`)).tracks ?? []).map((t) => t.track);
    if (!known.includes(track)) {
      console.error(`::error::la piste « ${track} » n'existe pas sur ${pkg}.`);
      console.error(`Pistes réelles : ${known.join(', ')}`);
      console.error('Le workflow « Play — lister les pistes » (play-tracks.yml) les affiche avec leurs releases.');
      process.exit(1);
    }

    const notes = releaseNotes();
    const release = {
      name: version,
      versionCodes,
      status,
      ...(notes.length > 0 ? { releaseNotes: notes } : {}),
    };
    if (notes.length === 0) console.log('[play] aucune note (pas de --changelog) — la piste garde les siennes.');

    // PUT sur LA piste demandée, et elle seule.
    await play.call(`${base}/edits/${editId}/tracks/${encodeURIComponent(track)}`, {
      method: 'PUT',
      body: { track, releases: [release] },
    });
    console.log(`[play] piste « ${track} » ← ${version} (${versionCodes.join(', ')}), statut « ${status} », notes : ${notes.map((n) => n.language).join(' + ') || 'aucune'}.`);

    if (dryRun) {
      await play.call(`${base}/edits/${editId}`, { method: 'DELETE' });
      console.log('[play] --dry-run : édition jetée, RIEN n\'a été publié.');
      return { versionCodes, committed: false };
    }

    // changesNotSentForReview=false : la release part en examen ET se publie
    // toute seule à l'approbation — à condition que « Publication gérée » soit
    // DÉSACTIVÉE dans la console, sinon tout reste en « Prêt à publier ».
    await play.call(`${base}/edits/${editId}:commit?changesNotSentForReview=false`, { method: 'POST', body: {} });
    console.log(`[play] édition ${editId} commitée ✓`);
    return { versionCodes, committed: true };
  } catch (e) {
    await play.call(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
    throw e;
  }
}

/**
 * Ne vaut la peine d'être rejoué qu'en cas de collision d'édition ou de panne
 * passagère. Un compte de service invalide ne guérit pas en vingt secondes —
 * le rejouer ne ferait que doubler le message d'erreur.
 */
const isTransient = (e) => /→ (409|429|5\d\d) |editAlreadyCommitted|editExpired|fetch failed|ECONN|ETIMEDOUT/i.test(e.message);

const play = await createPlayClient(process.env.PLAY_SERVICE_ACCOUNT_JSON);
let result;
try {
  result = await publish(play);
} catch (e) {
  if (!isTransient(e)) {
    console.error(`::error::publication Play impossible : ${e.message}`);
    process.exit(1);
  }
  console.error(`[play] édition perdue (${e.message}) — nouvel essai unique dans 20 s.`);
  await new Promise((r) => setTimeout(r, 20_000));
  result = await publish(play).catch((e2) => {
    console.error(`::error::publication Play impossible : ${e2.message}`);
    process.exit(1);
  });
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `version_code=${result.versionCodes.join(',')}\nversion_name=${version}\ntrack=${track}\ncommitted=${result.committed}\n`);
}
