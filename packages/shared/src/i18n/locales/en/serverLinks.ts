/**
 * Les liens du serveur — le lien public et la lecture directe. UNE source,
 * lue par la vue d'ensemble de l'administration et par l'assistant
 * d'installation ; la règle qui décide de l'état est dans
 * `serverLinks/serverLinksVerdict.ts`.
 *
 * Les clés `issue_*`, `note_*` et `benefit_*` suivent les identifiants du
 * verdict : ne pas les renommer sans eux.
 */
export default {
  sectionTitle: "Server access",
  sectionDescription: "Two addresses make Tentacle usable anywhere, and smoother at home. The server checks each one.",
  progress: "{{done}} of {{total}}",
  allDone: "All set",
  progressLabel: "Links in place",

  check_publicUrl: "Public link",
  check_directPlay: "Direct playback (local network and Internet)",
  summary_publicUrl: "Tentacle's address on the Internet.",
  summary_directPlay: "Devices play straight from Jellyfin, without the video going through the Tentacle server.",
  whyTitle: "Why?",
  benefit_publicUrl_away: "Away from home: your movies and shows on mobile data, on holiday, at friends'.",
  benefit_publicUrl_apps: "Mobile apps and TVs: it's the address they receive when pairing and the one invitations carry. Without it, pairing a TV is blocked.",
  benefit_publicUrl_shares: "Sharing: a stats or My List link only opens for your friends if the server can be reached from the Internet.",
  benefit_directPlay_quality: "Better quality: the file comes as-is from Jellyfin, with no detour. Faster start, snappier seeking.",
  benefit_directPlay_load: "Less load: the Tentacle server no longer relays the video, it only points the way.",
  benefit_directPlay_local: "At home, the local network address: the video never leaves your network, the shortest path there is. Outside, the public address takes over on its own.",
  levelRecommended: "Recommended",

  state_done: "Done",
  state_todo: "To do",
  state_attention: "Check",
  state_unknown: "Not checked",

  role_tentacle: "Tentacle on the Internet",
  role_jellyfinPublic: "Jellyfin on the Internet",
  role_jellyfinPrivate: "Jellyfin on the local network",
  endpointMissing: "Not set",
  probe_ok_tentacle: "Responds — it's this server",
  probe_ok_jellyfin: "Responds — Jellyfin {{version}}",

  "issue_not-public": "Local network address: it can't be reached from the Internet.",
  "issue_internal-host": "An address only the server understands (localhost, a Docker container name): devices can't reach it.",
  "issue_not-https": "No HTTPS: passwords and tokens travel in clear text over the Internet.",
  "issue_mixed-content": "http:// while Tentacle is on https://: browsers block this stream (apps don't).",
  "issue_cors-missing": "Jellyfin doesn't allow Tentacle's address (CORS): direct playback fails in a browser. Saving direct playback again adds it.",
  "issue_other-server": "Responds, but it isn't this server.",
  "issue_other-server_jellyfinPublic": "Responds, but it isn't the Jellyfin connected to Tentacle.",
  "issue_other-server_jellyfinPrivate": "Responds, but it isn't the Jellyfin connected to Tentacle.",
  "issue_unexpected": "Something responds that is neither Tentacle nor Jellyfin.",
  "issue_http-error": "Responds with an HTTP {{status}} error.",
  "issue_unverified": "The server couldn't reach itself at this address. If it opens from a phone on mobile data, you're fine: some routers don't let a machine reach itself through its public address.",
  "issue_unverified_jellyfinPrivate": "The server can't reach Jellyfin at this address. Check it from a device at home.",

  "note_direct-disabled": "Direct playback is off: all video goes through the Tentacle server.",
  "note_legacy-relayed": "Apps that aren't up to date still play through the Tentacle server: this Jellyfin refuses their older authentication.",
  "note_from-env": "Comes from the TENTACLE_PUBLIC_URL environment variable.",

  actionSet: "Set up",
  actionEdit: "Edit",
  recheck: "Check again",
  checking: "Checking…",
  loadError: "Couldn't check the server's links.",
  retry: "Retry",
  outdatedServer: "Update the Tentacle server so it can check its links.",

  stepLabel: "Access",
  wizardTitle: "Access from anywhere",
  wizardSubtitle: "Optional — two recommended addresses. You can come back to them from the admin overview.",
  wizardLater: "None of this is required: without these addresses, Tentacle works at home and all video goes through the server.",
  fieldTentacle: "Tentacle public link",
  fieldTentacleHint: "This server's address on the Internet, ideally https://.",
  fieldJellyfinPublic: "Jellyfin on the Internet",
  fieldJellyfinPublicHint: "To play directly away from home.",
  fieldJellyfinPrivate: "Jellyfin on the local network",
  fieldJellyfinPrivateHint: "To play directly at home.",
  suggested: "Suggested from your setup — change it if needed.",
  directNeedsBoth: "Direct playback turns on once both Jellyfin addresses are set.",
  invalidUrl: "Invalid address — it starts with http:// or https://.",
  check: "Check",
  skip: "Skip for now",
  saveAndFinish: "Save and finish",
  saving: "Saving…",
  saveError: "Couldn't save: {{message}}",
} as const;
