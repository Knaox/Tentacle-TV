// « Reprendre ce qui a été testé » : y a-t-il VRAIMENT quelque chose à reprendre ?
//
// Au cran store, `promote` (le défaut) suppose qu'un run de test est passé par
// là. Quand ce n'est pas le cas, le plan disait « promote » quand même : les
// jobs de reprise échouaient à mi-chemin, pendant que Windows — qui ne connaît
// pas la promotion — construisait et partait au Microsoft Store seul (desktop
// 1.25.0, 2026-09-29). Ces verdicts sont rendus dans `prepare`, AVANT le
// moindre job : une cible sans rien à reprendre se construit.
//
// Tout est pur ici : les appels réseau vivent dans promote-probe.mjs.
import { SUBMITTED_VERSION_STATES, versionState } from './asc-api.mjs';
import { TV_VERSION_CODE_BASE } from './play-reporting.mjs';

/** La version X.Y.Z d'un nom de release Play (« 1.8.1 », « 1400123 (1.8.1) »), ou null. */
export const releaseVersion = (name) => String(name ?? '').match(/\b\d+\.\d+\.\d+\b/)?.[0] ?? null;

/**
 * App Store Connect. `ver` : la version App Store (null si elle n'existe pas),
 * `buildId` : le build qui y est rattaché (null si aucun).
 *
 * Une version déjà soumise ou en vente se « reprend » : asc-submit-review.mjs
 * la reconnaît et ne fait rien — c'est le cas d'un run rejoué.
 */
export function ascPromoteVerdict(ver, buildId) {
  if (!ver) return { plan: 'build', reason: "aucune version App Store — aucun run de test n'est passé par là" };
  const state = versionState(ver);
  if (state && SUBMITTED_VERSION_STATES.has(state)) return { plan: 'promote', reason: `version déjà en « ${state} »` };
  if (buildId) return { plan: 'promote', reason: `build rattaché (${buildId})` };
  return { plan: 'build', reason: 'la version existe mais aucun build n’y est rattaché' };
}

/**
 * Google Play, d'après l'API de rapports (lib/play-reporting.mjs — lecture
 * seule, aucune édition ouverte). Une piste de TEST doit servir une release
 * nommée `version`, aux versionCodes du bon form factor : la fiche est
 * partagée, et la release TV n'est pas une release du téléphone.
 *
 * @param {'phone'|'tv'} formFactor
 */
export function playPromoteVerdict(tracks, version, formFactor) {
  const ofFormFactor = (codes) => codes.length > 0 && codes.every((c) =>
    formFactor === 'tv' ? c >= TV_VERSION_CODE_BASE : c < TV_VERSION_CODE_BASE);
  for (const track of tracks ?? []) {
    if (/production/i.test(`${track?.type ?? ''} ${track?.displayName ?? ''}`)) continue;
    for (const rel of track.servingReleases ?? []) {
      const codes = (rel?.versionCodes ?? []).map(Number).filter(Number.isFinite);
      if (releaseVersion(rel?.displayName) === version && ofFormFactor(codes)) {
        return { plan: 'promote', reason: `« ${track.displayName ?? track.type} » sert ${version} [${codes.join(', ')}]` };
      }
    }
  }
  return { plan: 'build', reason: `aucune piste de test ne sert ${version}` };
}

/**
 * Les versionCodes à promouvoir depuis une piste lue par une édition
 * (androidpublisher) : la release SERVIE qui porte `version`, et elle seule.
 * Prendre « le plus haut code servi », sans regarder le nom, portait en
 * production le binaire d'une version PRÉCÉDENTE sous le numéro et les notes
 * de la nouvelle, dès qu'aucun run de test n'avait posé celle-ci.
 */
export function promotableVersionCodes(trackData, version) {
  const served = (trackData?.releases ?? [])
    .filter((r) => ['completed', 'inProgress'].includes(r.status) && releaseVersion(r.name) === version);
  const codes = served.flatMap((r) => (r.versionCodes ?? []).map(Number)).filter(Number.isFinite);
  return codes.length > 0 ? [String(Math.max(...codes))] : null;
}
