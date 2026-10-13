/**
 * Les profils de la Famille sur l'application de BUREAU — voir la version
 * française (`fr/profilePicker.ts`), qui fait foi pour les clés.
 */
export default {
  whoIsWatching: "Who's watching?",
  loading: "Loading profiles…",
  opening: "Opening {{name}}…",
  manageProfiles: "Manage profiles",
  you: "You",
  guest: "Guest",
  hasPin: "Protected by a PIN",
  lockedUntil: "Locked until {{time}}",
  loadFailed: "The family's profiles couldn't be loaded.",
  retry: "Try again",
  tileLabel: "Open {{name}}'s profile",
  tileLabelPin: "Open {{name}}'s profile, protected by a PIN",
  pin: {
    title: "{{name}}'s PIN",
    prompt: "Enter the four digits.",
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
    cancel: "Cancel",
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
    current: "Current profile",
    switching: "Switching to {{name}}…",
    ownProfile: "Back to my profile",
  },
  session: {
    badge: "{{name}}'s profile",
    guestBadge: "Guest profile",
    ended: "This profile's session has ended.",
    restricted: "Switch back to your own profile to use this.",
  },
  launchSetting: {
    title: "Ask who's watching at startup",
    caption: "On all your computers: the app opens on the profile picker, each profile behind its PIN if it has one.",
    on: "On for all your computers",
    off: "Off",
    failed: "The setting couldn't be saved. Try again.",
  },
} as const;
