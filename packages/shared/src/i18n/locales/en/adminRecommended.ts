/**
 * Recommended extensions on the overview: what they bring, their one-click
 * install, and the GENERIC form an extension declares to connect itself
 * (`setup` in its manifest). An extension's texts live under
 * `rec_<pluginId>_*`; the form takes its words from the manifest.
 */
export default {
  title: "Recommended extensions",
  description: "Tentacle extensions that install in one click from the catalog, then connect right here.",

  rec_seer_name: "Vigie",
  rec_seer_pitch: "Your users request movies and shows from Tentacle, follow their arrival and see what's coming next.",
  rec_seer_benefit1: "A “Request” button on titles the server does not have",
  rec_seer_benefit2: "The requester is told as soon as the title arrives",
  rec_seer_benefit3: "The calendar of upcoming releases",
  rec_seer_needs: "Requires a Jellyseerr or Overseerr instance.",

  statusMissing: "Not installed",
  statusDisabled: "Disabled",
  statusRestart: "Server restart required",
  statusFailed: "Server module failed",
  statusSetup: "To connect",
  statusReady: "Ready",
  install: "Install {{name}}",
  installing: "Installing…",
  enable: "Enable",
  enabling: "Enabling…",
  configure: "Configure",
  settings: "Settings",
  open: "Open {{name}}",
  notFound: "Not found in your sources' catalog.",
  showSources: "See sources",
  catalogError: "The catalog does not answer: try again in a moment.",
  restartBody: "The Tentacle server needs a restart to load the extension — the banner above offers it.",
  failedBody: "The extension's server module did not start.",
  manage: "Manage in Plugins",
  readyBody: "Connected and active.",

  // An extension's generic form
  setupTest: "Test",
  setupTesting: "Testing…",
  setupSave: "Test and enable",
  setupSaving: "Enabling…",
  setupKeep: "Saved — leave empty to keep it",
  setupShowSecret: "Show",
  setupHideSecret: "Hide",
  setupOk: "Test passed",
  setupOkVersion: "Test passed — version {{version}}",
  setupSaved: "{{name}} is connected and active.",
  setupRequired: "This field is required.",
  setupInvalidUrl: "Invalid address: it starts with http:// or https://",
  setupNotRunning: "The extension's server module is not running yet: restart the Tentacle server.",
  setupFailed: "The test failed.",
  setupUnreachable: "The Tentacle server does not answer.",
  setupLoadError: "Could not read the extension's configuration.",
  setupRetry: "Retry",
  setupOtherSettings: "Other settings",
};
