/**
 * The page of a BLOCKED account (disabled, outside its hours) and refused sign-ins —
 * web, desktop, Apple TV (docs/DROITS-UTILISATEURS.md § 9.1). Same keys and
 * variables as French (`accountAccessVocabulary.test.ts`).
 */
export default {
  disabled: {
    title: "This account has been disabled",
    body: "The server administrator has disabled this account. Tentacle is unavailable to it until they enable it again.",
  },
  lockedOut: {
    title: "This account is locked",
    body: "This account was locked after too many password attempts. Contact the server administrator to unlock it.",
  },
  outsideSchedule: {
    title: "Tentacle isn't available to this account right now",
    body: "The server administrator has set the hours when this account can use Tentacle.",
  },
  schedulesTitle: "Allowed hours",
  days: {
    Everyday: "Every day",
    Weekday: "Monday to Friday",
    Weekend: "Weekends",
    Monday: "Mondays",
    Tuesday: "Tuesdays",
    Wednesday: "Wednesdays",
    Thursday: "Thursdays",
    Friday: "Fridays",
    Saturday: "Saturdays",
    Sunday: "Sundays",
  },
  range: "from {{from}} to {{to}}",
  midnight: "midnight",
  reopening: {
    today: "Tentacle reopens today at {{time}}.",
    tomorrow: "Tentacle reopens tomorrow at {{time}}.",
    later: "Tentacle reopens on {{day}} at {{time}}.",
    never: "No hours are open for this account.",
    unknown: "Tentacle will reopen for this account during the hours set by the administrator.",
  },
  footer: "This page will go away on its own as soon as access is restored.",
  footerDisabled: "Once the account is enabled again, you may need to sign in again.",
  actions: {
    signOut: "Sign out",
    changeServer: "Change server",
    switchProfile: "Switch profile",
    unpair: "Disconnect from server",
  },
  refusals: {
    account_disabled: "This account has been disabled by the server administrator.",
    account_locked_out: "This account is locked after too many attempts. Contact the administrator.",
    account_outside_schedule: "This account can't sign in at this time: the administrator has set its access hours.",
    account_max_sessions_one: "This account is already signed in on {{count}} device, the maximum allowed by the administrator.",
    account_max_sessions_other: "This account is already signed in on {{count}} devices, the maximum allowed by the administrator.",
  },
} as const;
