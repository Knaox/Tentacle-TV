/**
 * The setup wizard in the "Tentacle Server" Windows app: this PC's Jellyfin
 * (detected, installed with the official installer, started) and the Explorer
 * "Choose a folder" dialog. Merged into `setupWizard`.
 */
export default {
  jfSubtitleWindowsApp: "Tentacle looks for Jellyfin on this PC and on your network.",
  localChecking: "Looking for Jellyfin on this PC…",
  localStoppedTray: "Jellyfin is installed on this PC, but it is stopped.",
  localStartHint: "Jellyfin must be running for Tentacle to connect to it. Once started, it will start again on its own each time you sign in to Windows.",
  localStart: "Start Jellyfin",
  localOpenServices: "Open Services",
  localStarting: "Starting Jellyfin…",
  localStartWaiting: "Jellyfin is starting. Tentacle checks every few seconds.",
  localStoppedService:
    "Jellyfin is installed as a Windows service, and it is stopped. Open Services (Windows key, then \"services\"), pick \"Jellyfin Server\", then \"Start\". Tentacle never starts a service for you.",
  localStoppedUnknown: "Jellyfin seems to be installed on this PC, but it does not answer. Start it, then search again.",
  localStartFailed: "Jellyfin could not be started. Launch it from the Start menu, then search again.",

  installTitle: "Install Jellyfin on this PC",
  installIntro:
    "Jellyfin is the free media server that plays your movies; Tentacle relies on it. Tentacle can download its official installer from jellyfin.org, check that it is intact, then open it.",
  installAdvice: "In the installer, choose \"Basic Install\": Jellyfin will start with your Windows session, without a service.",
  installButton: "Download and install Jellyfin",
  installOpenSite: "Open jellyfin.org",
  installRetry: "Try again",
  install_resolving: "Finding the version to install…",
  install_downloading: "Downloading Jellyfin {{version}}: {{percent}}%",
  install_downloadingUnknown: "Downloading Jellyfin {{version}}…",
  install_verifying: "Checking the installer…",
  install_installing: "The Jellyfin installer is open. Windows asks for your approval first; then choose \"Basic Install\" and follow its screens.",
  install_done: "Jellyfin is installed. Tentacle is looking for it…",
  installFailed_unsupported_arch:
    "Jellyfin does not publish an installer for this PC (ARM processor). Download it from jellyfin.org, then come back here: Tentacle will find it.",
  installFailed_disabled: "Download Jellyfin from jellyfin.org and install it (choose \"Basic Install\"), then come back here: Tentacle will find it.",
  installFailed_no_version: "Tentacle found no Jellyfin version to install. Download it from jellyfin.org, then come back here.",
  installFailed_network: "Downloading Jellyfin failed. Check the Internet connection and try again, or download it from jellyfin.org.",
  installFailed_checksum:
    "The downloaded installer does not match the one Jellyfin publishes: it was deleted, and nothing was run. Try again, or download it from jellyfin.org.",
  installFailed_cancelled: "Installing Jellyfin was cancelled. You can start it again.",
  installFailed_blocked:
    "Windows blocked the Jellyfin installer (Smart App Control, or a rule on this PC). Download it from jellyfin.org and run it yourself, then come back here.",
  installFailed_installer_failed: "The Jellyfin installer stopped on an error. Try again, or download it from jellyfin.org.",

  explorerPick: "Browse with File Explorer",
  explorerPicking: "Choose the folder in the File Explorer window…",
  explorerTitle: "Folder for \"{{name}}\"",
  explorerTitleUnnamed: "Library folder",
  explorerMapped: "\"{{path}}\" is a mapped network drive: Jellyfin does not see it under that letter. Use its network path, {{unc}}.",
  explorerUseUnc: "Use {{unc}}",
  explorerNotFound: "Jellyfin cannot see \"{{path}}\". Check that the folder exists and that Jellyfin can read it.",
  libraryBrowseJellyfin: "Browse Jellyfin's folders",
};
