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
  databaseWontOpen: "Won't open",
  databaseOnNetwork: "Network share",
  publicUrlSet: "Set",
  publicUrlMissing: "Not set",
  // Clé gardée (i18n) : le jumelage n'est plus bloqué, il reste à la maison.
  publicUrlPairingBlocked: "TV pairing: local network only",
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

  // Database: an SQLite file, nothing to set up (server 1.25 and later).
  databaseTitle: "Database",
  databaseDescription:
    "The file where the server keeps its configuration, paired devices, tickets and preferences. Nothing to set up: it lives in the server's data folder.",
  databaseEngine: "Engine",
  databaseVersion: "Version",
  databaseSize: "Size",
  databasePath: "File",
  databaseErrorTitle: "The server can't open the database",
  databaseErrorLogs: "The server's logs say why.",
  databaseNetworkTitle: "The database is on a network share",
  databaseNetwork:
    "Tentacle's data folder is on a network share (NFS, SMB…), where SQLite can get corrupted. Move it to a local disk of the machine running the server.",
  // A server before 1.25, on MariaDB: its connection, shown without a form.
  databaseDescriptionMariaDb:
    "The MariaDB database where the server keeps its configuration, paired devices, tickets and preferences.",
  databaseHost: "Host",
  databasePort: "Port",
  databaseName: "Database",
  databaseUser: "User",
  databasePending:
    "Another connection is saved: it takes effect at the next server restart. This one stays in service until then.",

  // Public address.
  publicUrlTitle: "Public address",
  publicUrlDescription:
    "The address devices use to reach this server from the Internet — the domain behind Cloudflare, for instance. TVs receive it when pairing: without it, they receive the server's local network address, and only reach it from home.",
  publicUrlLabel: "Tentacle TV server public URL",
  publicUrlHint: "For instance https://tentacle.example.com.",
  publicUrlHintEnv: "Leave empty to use the TENTACLE_PUBLIC_URL environment variable ({{url}}).",
  publicUrlInEffect: "In service: {{url}}",
  publicUrlFromEnv: "environment variable",
  publicUrlNone: "No public address: TVs pair on the local network only.",
  publicUrlSaved: "Public address saved.",
  publicUrlCleared: "Address cleared.",

  // Direct play.
  // Addresses moved to "Remote access" (server 1.24.0 and later).
  movedTitle: "Addresses and direct play",
  movedBody: "The public link, the Jellyfin addresses and direct play are now set in Remote access, along with everything that follows from them.",
  movedLink: "Open Remote access",

  directTitle: "Direct play",
  directDescription:
    "Apps read videos and images from Jellyfin without going through the Tentacle server. Each device gets the address that suits it: the private one on the local network, the public one elsewhere.",
  directEnable: "Enable direct play",
  directEnableHint: "When off, everything goes through the Tentacle server: simpler, but heavier on it.",
  directPublicLabel: "Jellyfin public URL",
  directPublicHint: "Reachable from the Internet, for instance https://jf.example.com.",
  directPrivateLabel: "Jellyfin private URL (local network)",
  directPrivateHint: "Reachable from the local network, for instance http://192.168.1.50:8096.",
  directPrivateRequired: "The private address is needed to turn on direct play.",
  directPublicSwitch: "Direct play from outside (optional)",
  directPublicSwitchHint: "Off: away from home, playback goes through Tentacle. On: Jellyfin must be reachable from the Internet.",
  directPublicMissing: "Give Jellyfin's public address, or turn off direct play from outside.",
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
    "Jellyfin plugins remain the primary source for skip segments: installing one enriches every device at once. Tentacle's built-in analysis comes after them — it fills in what they don't say, and corrects end credits that swallow a scene.",
  segmentsPlugins: "Jellyfin plugins",
  opensNewTab: "(opens in a new tab)",
  plugin_introSkipper: "Audio fingerprint detection — intro and credits.",
  plugin_chapterSegments: "Turns named chapters into segments, no analysis.",
  plugin_introDb: "Community timestamp database, no local analysis.",
  plugin_skipmeDb: "Shared timestamp database, complementing Intro Skipper.",
  segmentsLearnMore: "How it works",
  segmentsScanHelp:
    "They stack: each reports what it knows, the most precise wins. “Install / repair” adds their repositories, installs them, restarts Jellyfin when needed (never while someone is watching, unless you ask) and sets them up. An offline repository blocks nothing: just run it again later.",
  // Server without "Install / repair" (before 1.24.0): the sentence without the action.
  segmentsStackHelp: "They stack: each reports what it knows, the most precise wins.",
  segmentsFrameNote:
    "On the first play of every movie and episode, Tentacle reads its ending: the progress bar thumbnails show where the credits roll, the audio tells music from dialogue. From them it finds where the credits start and the scenes that follow, mid-credits and post-credits alike — even when a plugin had already set credits. Jellyfin's \"Generate Trickplay Images\" task must have run on the media; only what is found gets saved.",
  audioTitle: "Audio analysis",
  audioNote:
    "Off by default. When on, Tentacle listens to the end of every movie and episode to tell its scenes apart from the credits; and for an episode with no known segments, to the start and end of its season neighbours: what repeats is the opening or the ending. Once per media, on first play; audio clips transcoded by Jellyfin, one at a time, never while another viewer is transcoding video. Nothing is saved when the analysis finds nothing.",
  audioTool: "Fingerprint tool on this server: {{tool}}.",
  audioUnavailable:
    "No fingerprint tool on this server (fpcalc, or ffmpeg with chromaprint): comparing season neighbours is inactive. The official Docker image ships it.",
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
