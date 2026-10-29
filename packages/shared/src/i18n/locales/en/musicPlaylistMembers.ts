/**
 * Octave — a playlist SHARED between accounts of the same server (`music.playlistMembers` capability). Read by
 * web, desktop and mobile: never “download”.
 */
export default {
  shareWith: "Share with…",
  title: "Share “{{name}}”",
  intro: "People on this server you add will find the playlist in their Octave. Everyone listens in their own order.",
  rights: {
    read: "Listen",
    add: "Listen and add",
    remove: "Listen, add and remove",
  },
  rightOf: "{{name}}'s access",
  removeMember: "Remove {{name}}",
  addTitle: "Add someone",
  addAs: "With access",
  addPerson: "Add {{name}}",
  noCandidates: "No other account on this server can receive a playlist.",
  empty: "Nobody else has access to this playlist yet.",
  members: "Has access",
  owner: "Owner",
  sharedBy: "Shared by {{name}}",
  yourRight: {
    read: "you can listen to it",
    add: "you can add tracks",
    remove: "you can add and remove tracks",
  },
  sharedWith: "Shared with {{names}}",
  shared: "Shared",
  people: "People",
  peopleTitle: "People in “{{name}}”",
  leave: "Leave playlist",
  leaveTitle: "Leave “{{name}}”?",
  leaveMessage: "It disappears from your playlists. To get it back, {{owner}} will have to share it with you again.",
  leaveConfirm: "Leave",
  cancel: "Cancel",
  close: "Close",
  loading: "Loading…",
  failed: "This change couldn't be saved. Try again in a moment.",
  unavailable: "Sharing with other accounts isn't available for this profile.",
};
