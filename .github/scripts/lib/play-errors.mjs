// Les refus de Google Play qui ne se corrigent PAS dans le dépôt : une
// déclaration à remplir dans la console. Le message brut de l'API ne dit ni où
// aller ni quoi cocher ; le journal le dit à sa place.
//
// Le cas du 2026-10-28 : la lecture d'Octave en arrière-plan a ajouté
// FOREGROUND_SERVICE_MEDIA_PLAYBACK au manifeste. Play a refusé le commit de
// l'édition (403 « You must let us know whether your app uses any Foreground
// Service permissions ») jusqu'à ce que la déclaration couvre ce type.

/**
 * Les services de premier plan que l'app mobile DÉCLARE dans la console, par
 * permission : le type du manifeste et le module qui le porte. Un type
 * nouveau dans un module exige une nouvelle déclaration AVANT la livraison
 * (test `play-errors.test.mjs`, qui relit les manifestes des modules).
 */
export const DECLARED_FOREGROUND_SERVICES = Object.freeze({
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC': { type: 'dataSync', module: 'offline-storage' },
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK': { type: 'mediaPlayback', module: 'octave-audio' },
});

const FOREGROUND_SERVICE_REFUSAL = /Foreground Service permissions/i;

/** Lignes d'explication pour un refus de Play, ou `null` si le refus n'est pas une déclaration manquante. */
export function explainPlayError(message, pkg) {
  if (!FOREGROUND_SERVICE_REFUSAL.test(String(message))) return null;
  const declared = Object.entries(DECLARED_FOREGROUND_SERVICES)
    .map(([permission, { type }]) => `${permission.replace('android.permission.', '')} (${type})`)
    .join(', ');
  return [
    'Play exige la déclaration des services de premier plan : rien à corriger dans le dépôt, la console seulement.',
    `Play Console › ${pkg ?? "l'app"} › Contenu de l'application (« Surveiller et améliorer ») › Permissions de service de premier plan.`,
    `Chaque permission FOREGROUND_SERVICE_* du manifeste doit y être cochée, avec sa justification et sa vidéo : ${declared}.`,
    "Une fois la déclaration envoyée, relancer le workflow : l'AAB déjà construit n'a pas à changer.",
  ];
}
