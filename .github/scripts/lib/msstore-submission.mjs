// La forme d'une soumission Microsoft Store, publique ou dans un VOL de paquet.
// Aucune entrée/sortie : msstore-submit.mjs fait les appels, ce module dit
// QUELLES routes et QUELS champs, et se rejoue hors ligne
// (test/msstore-submission.test.mjs).
//
// UN VOL DE PAQUET (« package flight ») sert un paquet à un groupe de testeurs
// choisi dans le Partner Center, sans toucher la fiche publique : c'est le cran
// test d'une app du Store, le seul moyen d'éprouver une installation et une
// mise à jour PAR LE STORE avant tout le monde. L'API en est le calque de celle
// des soumissions publiques, sous `/flights/<id>`, à trois différences près :
// la soumission pendante s'appelle `pendingFlightSubmission`, les paquets
// `flightPackages`, et il n'y a PAS de fiche — donc pas de « Nouveautés ».

/** @param {{ flightId?: string }} p */
export function submissionTarget({ flightId = '' } = {}) {
  if (flightId) {
    return {
      label: `vol ${flightId}`,
      path: `/flights/${encodeURIComponent(flightId)}`,
      pendingKey: 'pendingFlightSubmission',
      packagesKey: 'flightPackages',
      notes: false,
    };
  }
  return {
    label: 'fiche publique',
    path: '',
    pendingKey: 'pendingApplicationSubmission',
    packagesKey: 'applicationPackages',
    notes: true,
  };
}

/**
 * Mutation MINIMALE du clone renvoyé par POST …/submissions : le PUT remplace
 * l'objet entier, donc on renvoie le clone intégral (bandes-annonces, prix,
 * groupes du vol préservés). Rend les lignes de journal à afficher.
 *
 * @param {object} sub           le clone, muté sur place
 * @param {ReturnType<typeof submissionTarget>} target
 * @param {{ notes: {fr?: string|null, en?: string|null}|null, packageFileName: string }} input
 */
export function prepareSubmission(sub, target, { notes, packageFileName }) {
  const log = [];
  if (target.notes) {
    if (!notes) {
      log.push({ level: 'warn', text: 'pas de bloc de notes pour cette version — publication SANS « Nouveautés ».' });
    }
    for (const [lang, text] of [['fr-fr', notes?.fr], ['en-us', notes?.en]]) {
      if (!text) continue;
      const listing = sub.listings?.[lang]?.baseListing;
      if (!listing) {
        log.push({ level: 'warn', text: `listing ${lang} absent du Store — notes ${lang} ignorées.` });
        continue;
      }
      listing.releaseNotes = text;
      log.push({ level: 'info', text: `« Nouveautés » ${lang} posées (${text.length} car.).` });
    }
  } else {
    log.push({ level: 'info', text: `${target.label} : pas de fiche, donc pas de « Nouveautés » à poser.` });
  }

  const packages = sub[target.packagesKey] ?? [];
  for (const p of packages) p.fileStatus = 'PendingDelete';
  sub[target.packagesKey] = [...packages, { fileName: packageFileName, fileStatus: 'PendingUpload' }];
  // Publication dès la certification : le geste a déjà été choisi par le cran.
  sub.targetPublishMode = 'Immediate';
  return log;
}
