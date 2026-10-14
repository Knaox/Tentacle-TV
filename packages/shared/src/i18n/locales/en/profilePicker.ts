/**
 * Les profils de la Famille sur l'application de BUREAU — voir la version
 * française (`fr/profilePicker.ts`), qui fait foi pour les clés.
 */
export default {
  whoIsWatching: "Who's watching?",
  loading: "Loading profiles…",
  opening: "Opening {{name}}…",
  manageProfiles: "Manage profiles",
  stayOnDevice: "Don't ask on this device",
  stayOnDeviceHint: "This computer will open straight to the chosen profile. To change it, switch profiles from your avatar menu.",
  lockedUntil: "Locked until {{time}}",
  loadFailed: "The family's profiles couldn't be loaded.",
  retry: "Try again",
  tileLabel: "Open {{name}}'s profile",
  tileLabelPin: "Open {{name}}'s profile, protected by a PIN",
  pin: {
    title: "{{name}}'s PIN",
    prompt: "Enter this profile's PIN.",
    checking: "Checking…",
    wrong_one: "Wrong PIN — {{count}} attempt left before lockout.",
    wrong_other: "Wrong PIN — {{count}} attempts left before lockout.",
    locked: "Too many attempts. Try again at {{time}}.",
    progress_one: "{{count}} digit of 4",
    progress_other: "{{count}} digits of 4",
    erase: "Delete",
    digit: "Digit {{digit}}",
    keypad: "Keypad",
    back: "Back to profiles",
  },
  refusal: {
    unavailable: "This profile is no longer available.",
    disabled: "The server administrator turned family profiles off.",
    guestsDisabled: "The server administrator turned guest profiles off.",
    offline: "The server isn't responding. Check the connection, then try again.",
    failed: "This profile couldn't be opened. Try again.",
  },
  switcher: {
    title: "Switch profile",
    cancel: "Cancel",
  },
  session: {
    guestBadge: "Guest profile",
    memberBadge: "Family profile",
    ended: "This profile's session has ended.",
    offlineMessage: "This profile's library will come back on its own as soon as the connection is restored.",
  },
  launchSetting: {
    section: "On your computers",
    title: "Ask who's watching at startup",
    caption: "The app opens on “Who's watching?”: everyone picks their profile, behind its PIN if it has one. Switching profiles stays in your avatar menu.",
    on: "On for all your computers",
    off: "Off",
    failed: "The setting couldn't be saved. Try again.",
    stayHere: "On this computer, “Who's watching?” is no longer offered: {{name}}'s profile opens directly.",
    stayHereReset: "Ask again",
  },
} as const;
