/**
 * The setup wizard: the PATH (`setupFlowContract.ts`) — the chosen Jellyfin
 * shown at the top of each screen, nothing picked on the user's behalf, the
 * account created (new Jellyfin) or the sign-in (already set up Jellyfin).
 * Merged into the `setupWizard` namespace (`setupWizard.ts`).
 */
export default {
  chosenLabel: "The chosen Jellyfin",
  chosenServer: "Jellyfin “{{name}}” · {{state}}",
  chosenState_fresh: "new",
  chosenState_configured: "already set up",
  chosenInStack: "in this stack",

  jfRecommended: "Recommended",
  jfPickFirst: "Pick a Jellyfin from the list to continue.",
  jfPickContinue: "Continue",
  jfSelecting: "Checking the chosen Jellyfin…",
  jfChangeNotice: "You had chosen “{{name}}”. Picking another one drops what Tentacle had prepared for it; an account already created on a Jellyfin stays there.",

  accountDone: "The administrator account “{{name}}” is created on this Jellyfin.",
  accountDoneAnonymous: "The administrator account is created on this Jellyfin.",
  accountDoneVerify: "Type its name and password again to continue: the password is never stored.",
  accountVerify: "Check",

  signInTitle: "Sign in to this Jellyfin",
  signInSubtitle: "With an administrator account that already exists on this Jellyfin. The password only passes through: it is never stored.",
  signInNothingCreated: "Tentacle creates nothing on this Jellyfin: no account, no library.",
  signInDone: "Signed in to this Jellyfin as “{{name}}”.",
  signInOther: "Use another account",

  dbDone: "The database is connected.",
  recapLibrariesExisting: "Nothing created — already in Jellyfin: {{names}}",
};
