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
} as const;
