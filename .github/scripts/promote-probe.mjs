// Le pré-contrôle de la reprise, appelé par le job `prepare` des workflows de
// livraison pour chaque cible que le plan veut « promote ». Écrit `promote` ou
// `build` sur la sortie standard — et RIEN d'autre ; le pourquoi part en
// annotation sur la sortie d'erreur.
//
//   node promote-probe.mjs asc   — env ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8,
//                                  BUNDLE_ID, PLATFORM (MAC_OS|IOS|TV_OS), VERSION
//   node promote-probe.mjs play  — env PLAY_SERVICE_ACCOUNT_JSON, PLAY_PACKAGE,
//                                  FORM_FACTOR (phone|tv), VERSION
//   LABEL (optionnel) nomme la cible dans les annotations.
//
// LECTURE SEULE, des deux côtés. Côté Apple, la version n'est PAS créée si
// elle manque (ensureAppStoreVersion la créerait). Côté Play, aucune édition
// n'est ouverte : l'API de rapports liste les pistes sans rien verrouiller, et
// une édition ouverte pendant qu'un autre workflow publie invaliderait la sienne.
//
// Une vérification IMPOSSIBLE (réseau, droits) garde la reprise demandée : le
// job de reprise dira alors lui-même ce qui manque. Reconstruire sur une simple
// panne enverrait un binaire non testé là où un binaire testé attendait.
import { createAscClient, findApp } from './lib/asc-api.mjs';
import { fetchReleaseTracks } from './lib/play-reporting.mjs';
import { ascPromoteVerdict, playPromoteVerdict } from './lib/promote.mjs';

const store = process.argv[2];
const { VERSION, LABEL = store } = process.env;

async function probeAsc() {
  const { ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID, PLATFORM } = process.env;
  const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });
  const app = await findApp(api, BUNDLE_ID);
  const vers = await api('GET',
    `/v1/apps/${app.id}/appStoreVersions?filter[versionString]=${VERSION}&filter[platform]=${PLATFORM}&limit=1`);
  const ver = vers.data?.[0] ?? null;
  const attached = ver
    ? await api('GET', `/v1/appStoreVersions/${ver.id}/relationships/build`).catch(() => null)
    : null;
  return ascPromoteVerdict(ver, attached?.data?.id ?? null);
}

async function probePlay() {
  const { PLAY_SERVICE_ACCOUNT_JSON, PLAY_PACKAGE, FORM_FACTOR } = process.env;
  const tracks = await fetchReleaseTracks(PLAY_SERVICE_ACCOUNT_JSON, PLAY_PACKAGE);
  return playPromoteVerdict(tracks, VERSION, FORM_FACTOR);
}

const probes = { asc: probeAsc, play: probePlay };
if (!probes[store] || !VERSION) {
  console.error('usage : VERSION=X.Y.Z node promote-probe.mjs asc|play');
  process.exit(1);
}

try {
  const { plan, reason } = await probes[store]();
  if (plan === 'promote') {
    console.error(`::notice::${LABEL} ${VERSION} : reprise du binaire testé — ${reason}.`);
  } else {
    console.error(`::warning::${LABEL} ${VERSION} : rien à reprendre (${reason}) — la cible est CONSTRUITE au lieu d'être promue.`);
  }
  console.log(plan);
} catch (e) {
  console.error(`::warning::${LABEL} ${VERSION} : impossible de vérifier ce qu'il y a à reprendre (${e.message}) — la reprise demandée est gardée.`);
  console.log('promote');
}
