/**
 * The "Jellyfin" wizard screen: the footer line for the real state
 * (`jellyfinStepModel.ts`), the left column (the two kinds of Jellyfin, the
 * guided installation in three steps) and the address example for the
 * server's platform. Merged into `setupWizard`.
 */
export default {
  jfStatus_waitInstall: "Wait for the Jellyfin installation to finish.",
  jfStatus_waitStart: "Jellyfin is starting: it will appear in the list in a few seconds.",
  jfStatus_waitStack: "This stack's Jellyfin is starting: wait for it to answer.",
  jfStatus_searching: "Looking for Jellyfin…",
  jfStatus_installOrAddress: "Install Jellyfin, or enter its address, to continue.",
  jfStatus_startOrAddress: "Start Jellyfin, or enter its address, to continue.",
  jfStatus_address: "Enter Jellyfin's address to continue.",

  jfKindsTitle: "New or already set up?",
  jfInstallStepsTitle: "The installation, in three steps",
  jfInstallStepsLead: "Tentacle prepares the official installer, you follow it on screen, then Tentacle starts Jellyfin.",
  jfManualElsewhere: "I already have a Jellyfin elsewhere",

  jfUrlHintWindows: "For example http://localhost:8096 for a Jellyfin on this PC, or http://192.168.1.20:8096 (another PC's IP address).",
  jfUrlHintNative: "For example http://192.168.1.20:8096 (the IP address of Jellyfin's machine), or http://localhost:8096 if it runs on this machine.",
};
