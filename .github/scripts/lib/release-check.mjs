// Le CONTRÔLE AVANT PUBLICATION, commun à Google Play et App Store Connect.
//
// Une livraison qui REPREND un binaire déjà testé (« promote ») ou qui
// retombe sur une version ouverte puis jamais soumise (une 1.10.2 préparée
// dans App Store Connect, jamais certifiée) ne doit jamais partir avec le
// mauvais numéro, le mauvais binaire ou les notes d'une autre version
// (demande de Damien du 2026-10-20). Tout est relu chez le store, juste avant
// le geste qui publie — la release posée dans l'édition Play avant son
// commit, la version App Store avant `submitted: true` — et comparé à ce que
// la livraison voulait. Un écart = un refus, avec ce qui ne va pas.
//
// Pur : les scripts lisent, ces règles jugent. Testé hors ligne
// (test/release-check.test.mjs).
import { releaseVersion } from './promote.mjs';
import { compareVersions, isVersion } from './versions.mjs';

/** Un texte de notes comparable : fins de ligne et blancs de bord ignorés. */
export const normalizeNotes = (text) =>
  String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();

/**
 * La release qu'une édition Play s'apprête à publier sur `track`.
 *
 * @param {object} p
 * @param {string} p.track        la piste écrite
 * @param {object} p.trackData    la piste relue DANS l'édition (`releases`)
 * @param {string} p.version      la version livrée (X.Y.Z)
 * @param {string[]} p.versionCodes les versionCodes voulus
 * @param {{language: string, text: string}[]} p.notes les notes voulues
 * @param {string|null} p.productionVersion la version servie en production (même form factor)
 * @param {boolean} p.toProduction la piste écrite est une production
 * @returns {string[]} les problèmes ; vide = publiable
 */
export function playReleaseProblems({ track, trackData, version, versionCodes, notes, productionVersion, toProduction }) {
  const problems = [];
  const releases = trackData?.releases ?? [];
  if (releases.length !== 1) {
    problems.push(`« ${track} » porte ${releases.length} releases au lieu d'une seule (${describePlayReleases(releases)})`);
  }
  const release = releases.find((r) => releaseVersion(r.name) === version) ?? releases[0] ?? null;
  if (!release) return [...problems, `« ${track} » ne porte aucune release`];

  if (release.name !== version) problems.push(`« ${track} » : release nommée « ${release.name ?? '—'} » au lieu de « ${version} »`);
  const got = (release.versionCodes ?? []).map(String).sort();
  const want = (versionCodes ?? []).map(String).sort();
  if (got.join(',') !== want.join(',')) {
    problems.push(`« ${track} » : versionCode ${got.join(', ') || '—'} au lieu de ${want.join(', ') || '—'}`);
  }

  const posted = new Map((release.releaseNotes ?? []).map((n) => [n.language, normalizeNotes(n.text)]));
  for (const { language, text } of notes ?? []) {
    if (posted.get(language) !== normalizeNotes(text)) {
      problems.push(`« ${track} » : notes ${language} ${posted.has(language) ? 'différentes de celles de ' : 'absentes pour '}${version}`);
    }
  }

  // Jamais une production qui recule : un binaire repris d'une piste où
  // traînait une version plus ancienne n'y part pas sous un autre nom.
  if (toProduction && isVersion(productionVersion) && isVersion(version) && compareVersions(productionVersion, version) > 0) {
    problems.push(`la production sert déjà ${productionVersion}, plus récente que ${version}`);
  }
  return problems;
}

/** Les releases d'une piste, en une ligne : « 1.10.2 (draft) [vc 123] ». */
export const describePlayReleases = (releases) =>
  (releases ?? []).map((r) => `${r.name ?? '?'} (${r.status ?? '?'}) [vc ${(r.versionCodes ?? []).join(', ') || '—'}]`).join(' ; ') || 'aucune';

/**
 * Ce qu'une piste PERD quand la livraison la réécrit : toute release qui
 * n'est pas celle de la version livrée — un brouillon jamais publié, une
 * release d'une autre version. Le PUT de play-publish ne garde que la
 * nouvelle ; on le dit dans le journal plutôt que de le taire.
 */
export function playReplacedReleases(trackData, version) {
  return (trackData?.releases ?? []).filter((r) => releaseVersion(r.name) !== version);
}

/**
 * La version App Store juste avant l'envoi à l'examen.
 *
 * @param {object} p
 * @param {string} p.version       la version livrée
 * @param {string} p.platform      MAC_OS | IOS | TV_OS
 * @param {object} p.ver           la version App Store relue
 * @param {object|null} p.build    le build rattaché, relu (`attributes.version`, `processingState`, `expired`)
 * @param {object|null} p.preRelease son train TestFlight (`attributes.version`, `platform`)
 * @param {string|null} p.expectedBuildId le build que la livraison a voulu rattacher
 * @param {object[]} p.localizations les localisations relues (`locale`, `whatsNew`)
 * @param {[string, string][]} p.expectedNotes `[[locale, texte], …]` ; vide = pas de contrôle des notes
 * @returns {string[]} les problèmes ; vide = soumissible
 */
export function ascSubmissionProblems({ version, platform, ver, build, preRelease, expectedBuildId, localizations, expectedNotes }) {
  const problems = [];
  const a = ver?.attributes ?? {};
  if (a.versionString !== version) problems.push(`la version App Store s'appelle « ${a.versionString ?? '—'} » au lieu de « ${version} »`);
  if (a.platform && a.platform !== platform) problems.push(`la version App Store est sur ${a.platform}, pas sur ${platform}`);

  if (!build) {
    problems.push('aucun build rattaché à la version');
  } else {
    if (expectedBuildId && build.id !== expectedBuildId) problems.push(`build rattaché ${build.attributes?.version ?? build.id} au lieu du dernier build testé`);
    if (build.attributes?.processingState && build.attributes.processingState !== 'VALID') {
      problems.push(`le build ${build.attributes.version} est en « ${build.attributes.processingState} », pas traité`);
    }
    if (build.attributes?.expired === true) problems.push(`le build ${build.attributes.version} a expiré`);
    const pr = preRelease?.attributes ?? null;
    if (!pr) {
      problems.push(`le build ${build.attributes?.version ?? build.id} : train TestFlight illisible`);
    } else {
      if (pr.version !== version) problems.push(`le build ${build.attributes?.version} est un build de ${pr.version}, pas de ${version}`);
      if (pr.platform && pr.platform !== platform) problems.push(`le build ${build.attributes?.version} est un build ${pr.platform}, pas ${platform}`);
    }
  }

  return [...problems, ...ascNotesProblems(localizations, expectedNotes, version)];
}

/** Les « Nouveautés » relues face à celles attendues : une ligne par langue qui diffère. */
export function ascNotesProblems(localizations, expectedNotes, version) {
  const posted = new Map((localizations ?? []).map((l) => [l.attributes?.locale, normalizeNotes(l.attributes?.whatsNew)]));
  return (expectedNotes ?? [])
    .filter(([locale, text]) => posted.get(locale) !== normalizeNotes(text))
    .map(([locale]) => `« Nouveautés » ${locale} ${posted.get(locale) ? 'ne sont pas celles de' : 'absentes pour'} ${version}`);
}
