export default {
  // Existing keys (local pairing flow)
  pairDevice: "Pair device",
  enterCode: "Enter the 4-character code shown on your TV screen.",
  pair: "Pair",
  pairing: "Pairing...",
  pairSuccess: "Device \"{{name}}\" paired successfully!",
  codeInvalid: "Invalid or expired code. Check the code on your TV and try again.",
  codeExpireNote: "The code expires after 5 minutes. If expired, generate a new one.",
  tvPairTitle: "Pair this device",
  tvPairInstructions: "On your phone or computer, open Tentacle TV, go to Settings then Pair TV, and enter this code.",
  codeExpired: "Code expired",
  expiresIn: "Expires in {{time}}",
  generateNewCode: "Generate new code",
  pairingSuccess: "Pairing successful!",
  welcomeUser: "Welcome, {{username}}",
  howToConnect: "How would you like to connect?",
  pairWithCode: "Pair with a code",
  pairWithCodeDesc: "Enter a code from the web app",
  manualLogin: "Sign in manually",
  manualLoginDesc: "Enter username and password",
  checkServer: "Check server",
  serverConnected: "Server connected successfully!",
  tvRemoteHint: "Use the remote to enter your server address.",
  changeServer: "Change server",

  // Relay pairing (TV welcome)
  showPairingCode: "Show pairing code",
  configureManually: "Configure manually",
  tvWelcomeTitle: "Welcome to Tentacle TV",
  tvWelcomeSubtitle: "Pair this device to start watching.",
  cancel: "Cancel",

  // Provisioning code entry (TV store reviewers)
  haveCode: "I have a pairing code",
  enterProvisioningTitle: "Enter a pairing code",
  enterProvisioningSubtitle: "Enter the 12-character code provided to pair this device.",
  validateCode: "Validate code",
  checkingCode: "Checking...",
  codeProgress: "{{count}} / {{total}} characters",
  clearCode: "Clear",
  enterCodeRemoteHint: "Use the remote to enter the code, character by character. It validates automatically.",

  // Relay pairing (Web/Mobile enter code)
  pairYourTV: "Pair your TV",
  enterTVCode: "Enter the 4-character code shown on your TV screen.",
  pairTV: "Pair TV",
  tvPairedSuccess: "TV paired successfully!",
  relayError: "Could not reach the pairing service. Try again later.",

  // Paired devices management
  pairedDevices: "Paired devices",
  noPairedDevices: "No paired devices.",
  lastActive: "Last active: {{date}}",
  revoke: "Revoke",

  // "Pairing expired" banner (device Jellyfin token dead server-side)
  pairingExpiredBanner: "Pairing expired — reconfirm pairing from your profile to restore progress saving.",

  // Pairing unavailable (public server URL not configured on the backend)
  pairingUnavailable: "TV pairing is unavailable — this option must be enabled by the administrator.",
  pairingUnavailableAdmin: "Please first set the “Public Tentacle TV server URL” to enable TV pairing.",
  pairingConfigureNow: "Configure now",

  // The CLIENT's pairing screen — the one shown after forgetting the device.
  // It asks the relay for its own code: at that point the server is known, it
  // is the one serving the page, and the detour through the shell is moot.
  tvPreparingCode: "Preparing your code…",
  tvRetry: "Try again",

  tvNonJumeleTitre: "TV not paired",
  tvNonJumeleTexte:
    "This device is no longer linked to your account.",
  // The client cannot bring back the code screen: a page served over HTTP
  // cannot navigate to `file://`. Only a relaunch does, and the button now
  // says so instead of closing the app without warning.
  tvNonJumeleRelance:
    "Quit the app, then relaunch Tentacle TV from the TV menu: a new code will be shown.",
  tvQuitter: "Quit the app",

  // "Account" section of the TV settings.
  tvCompteJumele: "Paired account",
  tvServeur: "Server",
  tvVersion: "Version",
  tvOublierTitre: "Forget this pairing",
  redirectingHome: "Opening home…",
  tvOublierConfirmer: "Confirm",
  tvOublierTexte:
    "This TV will no longer be linked to your account and the app will close. Relaunch it to show a new code.",

  // "About" section of the TV settings.
  tvPlateforme: "Device",
} as const;
