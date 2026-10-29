/**
 * Octave — les FAVORIS de la bibliothèque (albums, artistes, playlists), l'ordre de ses rubriques et le menu
 * d'actions partagé (`collectionActions`). Lu par le web, le bureau et le mobile : jamais « téléchargement ».
 */
export default {
  shelfTitle: "Vos favoris",
  restTitle: {
    albums: "Tous les albums",
    artists: "Tous les artistes",
    playlists: "Toutes les playlists",
  },
  homeTitle: "Vos playlists favorites",
  favoriteBadge: "Favori",
  more: "Plus d'actions pour « {{name}} »",
  actions: {
    favorite: "Ajouter aux favoris",
    unfavorite: "Retirer des favoris",
    moveTop: "Mettre en haut",
    reorder: "Réordonner",
    edit: "Modifier",
    duplicate: "Dupliquer",
    shareWith: "Partager avec…",
    shareLink: "Partager un lien",
    members: "Personnes",
    leave: "Quitter la playlist",
    delete: "Supprimer",
  },
  reorder: {
    title: "Réordonner",
    hint: "Glissez par la poignée, ou utilisez les flèches. L'ordre se garde aussitôt, sur tous vos appareils.",
    done: "Terminé",
    handle: "Déplacer « {{name}} »",
    moveUp: "Monter « {{name}} »",
    moveDown: "Descendre « {{name}} »",
    moved: "« {{name}} » en position {{position}} sur {{total}}",
  },
  added: "« {{name}} » ajouté aux favoris",
  removed: "« {{name}} » retiré des favoris",
  failed: "Le favori n'a pas pu être gardé. Réessayez.",
};
