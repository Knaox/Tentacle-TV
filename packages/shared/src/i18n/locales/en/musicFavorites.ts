/**
 * Octave — library FAVORITES (albums, artists, playlists), the order of each section and the shared action menu
 * (`collectionActions`). Read by web, desktop and mobile: never "download".
 */
export default {
  shelfTitle: "Your favorites",
  restTitle: {
    albums: "All albums",
    artists: "All artists",
    playlists: "All playlists",
  },
  homeTitle: "Your favorite playlists",
  favoriteBadge: "Favorite",
  more: "More actions for “{{name}}”",
  actions: {
    favorite: "Add to favorites",
    unfavorite: "Remove from favorites",
    moveTop: "Move to top",
    reorder: "Reorder",
    edit: "Edit",
    duplicate: "Duplicate",
    shareWith: "Share with…",
    shareLink: "Share a link",
    members: "People",
    leave: "Leave playlist",
    delete: "Delete",
  },
  reorder: {
    title: "Reorder",
    hint: "Drag by the handle, or use the arrows. The order is saved right away, on all your devices.",
    done: "Done",
    handle: "Move “{{name}}”",
    moveUp: "Move “{{name}}” up",
    moveDown: "Move “{{name}}” down",
    moved: "“{{name}}” at position {{position}} of {{total}}",
  },
  added: "“{{name}}” added to favorites",
  removed: "“{{name}}” removed from favorites",
  failed: "The favorite couldn't be saved. Try again.",
};
