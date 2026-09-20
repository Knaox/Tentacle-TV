// Diagnostic : les derniers builds d'une app App Store Connect, toutes
// plateformes, avec leur état de traitement (PROCESSING | FAILED | INVALID |
// VALID) — SANS le filtre preReleaseVersion du rattachement, qui peut cacher
// un build invalide. Sert à savoir si un build envoyé (« UPLOAD SUCCEEDED »)
// a été vu, rejeté ou perdu par Apple. Env : ASC_KEY_ID, ASC_ISSUER,
// ASC_KEY_P8, BUNDLE_ID (défaut com.tentacle.mobile), LIMIT (défaut 12).
import { createAscClient, findApp } from './lib/asc-api.mjs';

const { ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID = 'com.tentacle.mobile', LIMIT = '12' } = process.env;
const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });
const app = await findApp(api, BUNDLE_ID);
const r = await api('GET',
  `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=${LIMIT}` +
  `&include=preReleaseVersion&fields[builds]=version,uploadedDate,processingState,expired,minOsVersion,preReleaseVersion` +
  `&fields[preReleaseVersions]=version,platform`);
const pre = new Map((r.included ?? []).filter((i) => i.type === 'preReleaseVersions').map((i) => [i.id, i.attributes]));
console.log(`[builds] ${BUNDLE_ID} (app ${app.id}) — ${r.data?.length ?? 0} derniers builds :`);
for (const b of r.data ?? []) {
  const p = pre.get(b.relationships?.preReleaseVersion?.data?.id);
  const a = b.attributes;
  console.log(`  ${a.uploadedDate}  ${(p?.platform ?? '?').padEnd(6)}  ${p?.version ?? '?'} (${a.version})  ${a.processingState}${a.expired ? '  expiré' : ''}  minOS ${a.minOsVersion ?? '?'}`);
}
