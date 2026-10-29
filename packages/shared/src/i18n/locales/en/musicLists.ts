/**
 * Octave (mobile, narrow web) — touch gestures on a track list and on playlists: "Edit" mode, drag, remove,
 * rename. The rest comes from the `music` (listOrder, playlistManage, playlist), `musicImport` and
 * `musicShare` namespaces.
 */
export default {
  edit: "Edit",
  done: "Done",
  editHint: "Drag the handle to change the order. Check tracks to remove them, add them to a playlist or to the queue.",
  reorderHint: "Drag the handle to change the order. Check tracks to add them to a playlist or to the queue.",
  removeRow: "Remove “{{title}}” from the playlist",
  moveUp: "Move up",
  moveDown: "Move down",
  moved: "“{{title}}” moved to position {{position}}",
  rename: "Rename",
  renameTitle: "Rename playlist",
  newTitle: "New playlist",
  newHint: "Give it a name; you'll add tracks from a track's “⋯” menu.",
  manage: "Manage “{{name}}”",
  likedSubtitle_one: "{{count}} liked track",
  likedSubtitle_other: "{{count}} liked tracks",
  owner: "By {{name}}",
  swipe: {
    remove: "Remove",
    nextNotice: "Playing next",
    queuedNotice: "Added to the queue",
    close: "Close the actions for “{{title}}”",
  },
};
