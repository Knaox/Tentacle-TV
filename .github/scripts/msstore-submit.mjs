// Soumission Microsoft Store via l'API Store Submission (remplace `msstore
// publish`, qui crée+commit en une passe sans permettre de poser les notes).
// Séquence : token Entra ID → suppression de la soumission pendante éventuelle
// → POST /submissions (clone de la dernière publiée) → mutation MINIMALE du
// clone (notes « Nouveautés » fr-fr/en-us + remplacement du package,
// publication auto conservée) → PUT complet → upload du zip vers le SAS →
// commit → polling jusqu'à acceptation (on n'attend PAS la certification
// complète, ~24-48 h). ÉCHEC FORT (exit 1) : c'est la publication elle-même.
//
// Env requis : PARTNER_TENANT_ID, PARTNER_CLIENT_ID, PARTNER_CLIENT_SECRET,
//   STORE_ID (applicationId, ex. 9NKHL0T84245), PACKAGE_ZIP (chemin du zip),
//   PACKAGE_FILE_NAME (nom du .msix DANS le zip), VERSION (x.y.z).
// Env optionnels : CHANNEL (défaut win), CHANGELOG (défaut CHANGELOG.md),
//   SUBMIT_TIMEOUT_MINUTES (30), POLL_SECONDS (30).
import fs from 'node:fs';
import { loadNotes } from './lib/changelog.mjs';

const {
  PARTNER_TENANT_ID, PARTNER_CLIENT_ID, PARTNER_CLIENT_SECRET,
  STORE_ID, PACKAGE_ZIP, PACKAGE_FILE_NAME, VERSION,
  CHANNEL = 'win', CHANGELOG = 'CHANGELOG.md',
} = process.env;
const TIMEOUT_MS = Number(process.env.SUBMIT_TIMEOUT_MINUTES ?? 30) * 60_000;
const POLL_MS = Number(process.env.POLL_SECONDS ?? 30) * 1000;

const FAILED_STATUSES = new Set([
  'CommitFailed', 'PreProcessingFailed', 'CertificationFailed', 'PublishFailed', 'ReleaseFailed', 'Canceled',
]);
// Soumission ACCEPTÉE par le Store (la certification/publication suit toute seule).
const ACCEPTED_STATUSES = new Set([
  'Certification', 'PendingPublication', 'Publishing', 'Published', 'Release',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) { console.error(`[msstore] ${msg}`); process.exit(1); }

async function main() {
  for (const [k, v] of Object.entries({ PARTNER_TENANT_ID, PARTNER_CLIENT_ID, PARTNER_CLIENT_SECRET, STORE_ID, PACKAGE_ZIP, PACKAGE_FILE_NAME })) {
    if (!v) fail(`variable ${k} manquante`);
  }

  // 1) Token Entra ID (client credentials, resource devcenter).
  const tokRes = await fetch(`https://login.microsoftonline.com/${PARTNER_TENANT_ID}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: PARTNER_CLIENT_ID,
      client_secret: PARTNER_CLIENT_SECRET,
      resource: 'https://manage.devcenter.microsoft.com',
    }),
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tokRes.ok || !tok.access_token) fail(`token Entra ID refusé (${tokRes.status}): ${JSON.stringify(tok)}`);

  const BASE = `https://manage.devcenter.microsoft.com/v1.0/my/applications/${STORE_ID}`;
  const api = async (method, path = '', body) => {
    const r = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path || '/'} → ${r.status} ${JSON.stringify(j)}`);
    return j;
  };

  // 2) Soumission pendante ? On la supprime (même comportement que le CLI).
  //    Si elle est déjà en certification, le DELETE échoue → on s'arrête au
  //    lieu d'annuler une certification en cours à l'aveugle.
  const app = await api('GET');
  const pending = app.pendingApplicationSubmission;
  if (pending?.id) {
    console.log(`[msstore] soumission pendante ${pending.id} — suppression…`);
    try {
      await api('DELETE', `/submissions/${pending.id}`);
    } catch (e) {
      fail(`suppression de la soumission pendante impossible (probablement en certification — à gérer dans le Partner Center) : ${e.message}`);
    }
  }

  // 3) Nouvelle soumission = clone de la dernière publiée (listings inclus).
  const sub = await api('POST', '/submissions');
  console.log(`[msstore] soumission ${sub.id} créée (clone de la publiée).`);

  // 4) Mutation minimale du clone (PUT remplace l'objet ENTIER → on renvoie le
  //    clone intégral, mutations comprises : trailers/pricing préservés).
  const notes = loadNotes({ changelog: CHANGELOG, channel: CHANNEL, version: VERSION, format: 'msstore' });
  if (notes) {
    for (const [lang, text] of [['fr-fr', notes.fr], ['en-us', notes.en]]) {
      if (!text) continue;
      const listing = sub.listings?.[lang]?.baseListing;
      if (!listing) { console.warn(`[msstore] listing ${lang} absent du Store — notes ${lang} ignorées.`); continue; }
      listing.releaseNotes = text;
      console.log(`[msstore] « Nouveautés » ${lang} posées (${text.length} car.).`);
    }
  } else {
    console.warn(`[msstore] pas de bloc CHANGELOG « ## [${CHANNEL}-${VERSION}] » — publication SANS notes.`);
  }
  for (const p of sub.applicationPackages ?? []) p.fileStatus = 'PendingDelete';
  sub.applicationPackages = [...(sub.applicationPackages ?? []), { fileName: PACKAGE_FILE_NAME, fileStatus: 'PendingUpload' }];
  sub.targetPublishMode = 'Immediate'; // publication auto (comportement msstore publish conservé)

  await api('PUT', `/submissions/${sub.id}`, sub);
  console.log('[msstore] soumission mise à jour (package + notes).');

  // 5) Upload du zip vers Azure Blob (SAS). Gotcha documenté : les « + » du SAS
  //    doivent être ré-encodés sinon 403 AuthenticationFailed.
  const uploadUrl = sub.fileUploadUrl.replace(/\+/g, '%2B');
  const zip = fs.readFileSync(PACKAGE_ZIP);
  const up = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Length': String(zip.length) },
    body: zip,
  });
  if (up.status !== 201) fail(`upload du package échoué (${up.status}): ${await up.text().catch(() => '')}`);
  console.log(`[msstore] package uploadé (${(zip.length / 1024 / 1024).toFixed(1)} Mo).`);

  // 6) Commit + polling du statut.
  await api('POST', `/submissions/${sub.id}/commit`);
  console.log('[msstore] commit lancé — polling du statut…');

  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    await sleep(POLL_MS);
    const st = await api('GET', `/submissions/${sub.id}/status`);
    const status = st.status ?? 'inconnu';
    if (ACCEPTED_STATUSES.has(status)) {
      console.log(`[msstore] soumission acceptée (statut : ${status}) — certification/publication automatiques côté Store. ✓`);
      return;
    }
    if (FAILED_STATUSES.has(status)) {
      console.error(`[msstore] échec (statut : ${status})`);
      for (const err of st.statusDetails?.errors ?? []) console.error(`  - ${err.code}: ${err.details}`);
      for (const w of st.statusDetails?.warnings ?? []) console.error(`  ⚠ ${w.code}: ${w.details}`);
      process.exit(1);
    }
    if (Date.now() > deadline) {
      fail(`timeout — statut « ${status} » ; la soumission ${sub.id} reste consultable dans le Partner Center.`);
    }
    console.log(`[msstore] statut : ${status}…`);
  }
}

main().catch((e) => fail(e.message));
