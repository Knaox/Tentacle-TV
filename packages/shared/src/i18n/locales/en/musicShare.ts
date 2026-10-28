/**
 * Octave — share a playlist by link (`music.playlistShare` capability, "Public sharing" right) and import one
 * a friend shared from THEIR Tentacle.
 */
export default {
  action: "Share",
  title: "Share “{{name}}”",
  intro: "Anyone with this link sees the playlist's name and its tracks — never your files. With their own Tentacle, they can import it: every track their library has goes in.",
  create: "Create link",
  creating: "Creating the link…",
  copy: "Copy link",
  copied: "Link copied",
  shareSheet: "Send the link",
  revoke: "Stop sharing",
  revoking: "Removing the link…",
  revoked: "The link no longer works.",
  revokeHint: "The link stops working right away. Sharing again gives a new one.",
  localOnly: "This link only uses your home address: it won't work elsewhere until the server's public link is set.",
  localOnlyAdmin: "Set up remote access",
  failed: "The link couldn't be created. Try again in a moment.",
  close: "Close",
  importTitle: "Shared playlist",
  importLead: "A friend shared a playlist from their Tentacle. Octave recreates it on your server, with the tracks from your library.",
};
