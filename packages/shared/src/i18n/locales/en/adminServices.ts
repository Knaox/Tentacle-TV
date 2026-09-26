/**
 * The admin "Services" page: the server's connections (Jellyfin, database,
 * public address, direct play), skip segment detection, danger zone.
 *
 * Its own namespace, like `adminPlugins`: the page carries more text than the
 * rest of the administration, and `admin` is shared by all its other pages.
 */
export default {
  title: "Services",
  description:
    "The Tentacle TV server's connections and settings: Jellyfin, database, public address, direct play and skip segment detection.",
  recheck: "Check again",
  checking: "Checking…",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  test: "Test",
  testing: "Testing…",
  unsaved: "Unsaved",
  loadError: "This section could not be loaded.",
  retry: "Retry",

  // The summary at the top of the page.
  summaryLabel: "Service status",
  summaryUnknown: "Unavailable",
  jellyfinConnected: "Connected",
  jellyfinUnreachable: "Unreachable",
  jellyfinRejected: "Key rejected",
  jellyfinNotJellyfin: "Wrong address",
  jellyfinNotConfigured: "Not configured",
  jellyfinKeyToReview: "Check the key",
  databaseConnected: "Connected",
  databaseDown: "Not responding",
  databaseNotConfigured: "Not configured",
  databaseRestart: "Restart required",
  publicUrlSet: "Set",
  publicUrlMissing: "Not set",
  publicUrlPairingBlocked: "TV pairing blocked",
  directOn: "On",
  directOff: "Off",
  audioOn: "On",
  audioOff: "Off",
  audioNoTool: "Unavailable",
  summaryAudio: "Audio analysis",

  // Jellyfin.
  jellyfinTitle: "Jellyfin",
  jellyfinDescription:
    "The media server Tentacle dresses up. Its admin key carries the work nobody sits behind: new-arrival notifications, invitations, account creation, admin screens.",
  jellyfinServer: "{{name}} · Jellyfin {{version}}",
  jellyfinVersionOnly: "Jellyfin {{version}}",
  jellyfinUrlLabel: "Jellyfin server address",
  jellyfinUrlHint:
    "As the Tentacle server reaches it: http://localhost:8096, or http://jellyfin:8096 between Docker containers.",
  jellyfinKeyLabel: "Admin API key",
  jellyfinKeyHint: "Created in Jellyfin › Dashboard › API Keys. It never leaves the Tentacle server.",
  jellyfinKeyKeep: "Key saved — leave empty to keep it",
  jellyfinKeyPaste: "Paste the API key",
  keyHealthOk: "Admin key recognized",
  keyHealthRevoked: "Key revoked or replaced in Jellyfin",
  keyHealthNoRights: "Key without admin rights",
  keyHealthMissing: "No key saved",
  jellyfinTestOk: "{{name}} responds — Jellyfin {{version}}",
  jellyfinSaved: "Jellyfin saved.",
  errorKeyMissing: "Enter the API key: none is saved.",
  errorUnreachable: "Jellyfin does not respond at this address.",
  errorNotJellyfin: "This address does not respond like a Jellyfin server.",
  errorRejected: "Jellyfin rejects the key (HTTP {{status}}).",
  errorInvalid: "A value is invalid.",
  errorGeneric: "The operation failed.",
  urlInvalid: "Invalid address: it starts with http:// or https://.",

  // Database.
  databaseTitle: "Database",
  databaseDescription:
    "The MariaDB database where the server keeps its configuration, paired devices, tickets and preferences.",
  databaseHost: "Host",
  databasePort: "Port",
  databaseName: "Database",
  databaseUser: "User",
  databasePassword: "Password",
  databaseVersion: "Version",
  databaseSourceEnv:
    "Set by the DATABASE_URL environment variable — docker-compose or a system service. That is where it changes, before restarting the server: changed here, it would be overwritten at the next start.",
  databaseSourceFile: "Saved by the server, in data/database.json.",
  databasePending:
    "Another connection is saved: it takes effect at the next server restart. This one stays in service until then.",
  databaseEdit: "Change the connection",
  databaseEditSummary: "To move the database to another MariaDB server.",
  databaseRestartNote:
    "The new connection takes effect at the next server restart. Nothing is copied between databases: the new one must already hold the data.",
  databasePasswordHint: "Asked for on every change: it never leaves the server.",
  databasePortInvalid: "A port between 1 and 65535.",
  databaseSaved: "Connection saved — restart the server to apply it.",

  // Public address.
  publicUrlTitle: "Public address",
  publicUrlDescription:
    "The address devices use to reach this server from the Internet — the domain behind Cloudflare, for instance. TVs receive it when pairing: without it, TV pairing is blocked.",
  publicUrlLabel: "Tentacle TV server public URL",
  publicUrlHint: "For instance https://tentacle.example.com.",
  publicUrlHintEnv: "Leave empty to use the TENTACLE_PUBLIC_URL environment variable ({{url}}).",
  publicUrlInEffect: "In service: {{url}}",
  publicUrlFromEnv: "environment variable",
  publicUrlNone: "No public address: TVs cannot be paired.",
  publicUrlSaved: "Public address saved.",
  publicUrlCleared: "Address cleared.",

  // Direct play.
  directTitle: "Direct play",
  directDescription:
    "Apps read videos and images from Jellyfin without going through the Tentacle server. Each device gets the address that suits it: the private one on the local network, the public one elsewhere.",
  directEnable: "Enable direct play",
  directEnableHint: "When off, everything goes through the Tentacle server: simpler, but heavier on it.",
  directPublicLabel: "Jellyfin public URL",
  directPublicHint: "Reachable from the Internet, for instance https://jf.example.com.",
  directPrivateLabel: "Jellyfin private URL (local network)",
  directPrivateHint: "Reachable from the local network, for instance http://192.168.1.50:8096.",
  directUrlsRequired: "Both addresses are needed to enable direct play.",
  directMixedContent:
    "HTTP address on an HTTPS site: the browser will block the streams (mixed content). Use an HTTPS address or an HTTPS proxy in front of Jellyfin.",
  directCorsHelp:
    "In a browser, Jellyfin must allow Tentacle's origin. On save, the server adds it to Jellyfin's CORS hosts itself; otherwise, it is in Jellyfin › Dashboard › Networking › CORS hosts.",
  directTestPublic: "Public address",
  directTestPrivate: "Private address",
  directTestOk: "Jellyfin {{version}}",
  directCorsOk: "CORS allowed",
  directCorsMissing: "No CORS",
  directCorsWarning:
    "Jellyfin does not allow Tentacle's origin: direct play will fail in browsers (not in the apps). Add Tentacle's address in Jellyfin › Dashboard › Networking › CORS hosts.",
  directTestNone: "No address to test.",
  directSaved: "Direct play saved.",

  // Skip segment detection.
  segmentsTitle: "Skip segment detection",
  segmentsDescription:
    "Jellyfin plugins remain the primary source for skip segments: they see the video and audio, whereas Tentacle's built-in analysis only reads thumbnails. Installing one enriches every device at once.",
  segmentsPlugins: "Jellyfin plugins",
  opensNewTab: "(opens in a new tab)",
  plugin_introSkipper: "Audio fingerprint detection — intro and credits.",
  plugin_chapterSegments: "Turns named chapters into segments, no analysis.",
  plugin_introDb: "Community timestamp database, no local analysis.",
  plugin_skipmeDb: "Shared timestamp database, complementing Intro Skipper.",
  segmentsScanHelp:
    "They stack: each reports what it knows, the most precise wins, and installing two causes no conflict. After installing, run Jellyfin's \"Media segment scan\" scheduled task — segments only appear once the library has been analysed.",
  segmentsFrameNote:
    "When no source says anything credible about the credits, Tentacle analyses the progress bar thumbnails itself (credits, post-credits scene) — provided Jellyfin's \"Generate Trickplay Images\" task has run on the media.",
  audioTitle: "Episode audio analysis",
  audioNote:
    "For an episode nobody has described, Tentacle listens to the start and end of the episode and its season neighbours: what repeats is the opening or the ending. Once per episode, on first play; two short audio clips transcoded by Jellyfin, never while another viewer is transcoding video; nothing is set when in doubt.",
  audioTool: "Fingerprint tool on this server: {{tool}}.",
  audioUnavailable:
    "No fingerprint tool on this server (fpcalc, or ffmpeg with chromaprint): audio analysis is inactive. The official Docker image ships it.",
  audioSince: "Since the server started",
  audioJobs: "Analyses",
  audioWindows: "Clips transcoded",
  audioData: "Data read",
  audioTime: "Transcoding time",
  audioVerdicts: "Segments found",
  audioSilent: "No verdict",
  audioDeferred: "Postponed (server busy)",
  audioEnabled: "Audio analysis enabled.",
  audioDisabled: "Audio analysis disabled.",

  // Danger zone.
  dangerTitle: "Danger zone",
  dangerDescription: "What happens here cannot be undone.",
  resetTitle: "Reset the server",
  resetDescription:
    "Erases the whole server configuration — Jellyfin connection, keys, public address, settings — and restarts the setup wizard. Paired devices, TVs and phones alike, will lose access and must be paired again.",
  resetAction: "Reset…",
  resetConfirmTitle: "Reset the server?",
  resetConfirmBody:
    "The Jellyfin connection, keys, public address and every setting will be erased, and the setup wizard restarted. Paired devices will have to be paired again. There is no way back.",
  resetConfirmPrompt: "To confirm, type \"{{word}}\":",
  resetConfirmWord: "reset",
  resetConfirm: "Reset for good",
  resetting: "Resetting…",
  resetFailed: "The reset failed: {{message}}",
} as const;
