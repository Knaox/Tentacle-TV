/**
 * La liaison de racine de l'aperçu de bande-annonce au survol, éteinte.
 *
 * Un téléviseur ne survole pas : la sélection, c'est le focus, et la Magic
 * Remote ne fait qu'y pointer. Et son décodeur n'accueille pas hls.js (déjà
 * remplacé). `AppBindings` monte la liaison qui nourrit le magasin de l'aperçu
 * (connectivité, gabarit) : ici, rien à nourrir. Le reste du moteur
 * (`apps/web/src/trailerPreview/`) n'a pas d'autre porte dans la dalle — la
 * mini-carte a la sienne, substituée de son côté — et son dossier est exclu
 * (`EXCLUDED_WEB_DIRECTORIES`) : s'il y entrait un jour, le build s'arrêterait.
 */
export function TrailerPreviewBinding(): null {
  return null;
}
