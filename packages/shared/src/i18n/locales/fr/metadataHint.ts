/**
 * Le message discret des fiches d'un titre que Jellyfin n'a pas (encore)
 * trouvé (`metadata/missingMetadata.ts`), et « Réanalyser maintenant » pour
 * un administrateur. Une seule source pour le web, le bureau, le miroir, le
 * mobile et les téléviseurs.
 *
 * ⚠️ Lu aussi par le MOBILE : jamais « téléchargement » ni « download » ici
 * (garde-fou : `metadataHintVocabulary.test.ts`). Espaces insécables ( )
 * devant « ? », « : » et « ! ».
 */
export default {
  title: "Images et informations à venir",
  body: "Les images et les informations viennent de Jellyfin. Elles n'ont pas encore été trouvées pour ce titre : une analyse de la bibliothèque peut être nécessaire. Vous pouvez déjà le regarder.",
  rescan: "Réanalyser maintenant",
  rescanning: "Lancement de l'analyse…",
  rescanStarted: "Analyse lancée — les images arrivent d'ici quelques minutes. La fiche se mettra à jour toute seule.",
  // Le conseil de l'administrateur : où Jellyfin cherche, et quoi vérifier.
  adminTip: "Jellyfin cherche images et résumés sur TMDB, par son greffon TMDb, d'après le nom du dossier (« Titre (année) »). Greffon coupé, nom méconnaissable ou Jellyfin sans accès à Internet : il ne trouve rien.",
  adminTipJellyfin: "Vérifier les réglages de Jellyfin",
  adminTipTmdbKey: "Ajouter la clé TMDB de Tentacle",
  rescanError_busy: "Une analyse est déjà en cours de lancement. Réessayez dans un instant.",
  "rescanError_not-found": "Jellyfin ne connaît plus ce titre. Rechargez la page.",
  "rescanError_not-configured": "Jellyfin n'est pas encore relié à Tentacle.",
  rescanError_unreachable: "Jellyfin ne répond pas. Réessayez dans un instant.",
  rescanError_rejected: "Jellyfin refuse la clé d'administration de Tentacle : voir l'administration.",
  "rescanError_bad-request": "Ce titre ne peut pas être analysé.",
  rescanError_failed: "L'analyse n'a pas pu être lancée. Réessayez dans un instant.",
  // Le téléviseur : pas de bouton, une phrase qui renvoie vers l'app.
  bodyTv: "Les images et les informations viennent de Jellyfin et n'ont pas encore été trouvées pour ce titre. Vous pouvez déjà le regarder.",
};
