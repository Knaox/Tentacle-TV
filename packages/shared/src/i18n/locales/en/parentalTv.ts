/**
 * SIMPLIFIED parental controls on TV (Apple TV, Android TV) — voir l'en-tête
 * de `locales/fr/parentalTv.ts`.
 */
export default {
  kicker: "Parental controls",
  title: "What {{name}} can watch",
  subtitle: "Jellyfin applies it right away, on all of their devices.",
  roles: {
    guest: "Guest",
    member: "Family member",
  },
  age: {
    title: "Maximum age",
    allAges: "All ages",
    years: "Age {{age}}",
    none: "No limit",
    custom: "Set elsewhere",
    summaryAllAges: "All-ages titles only.",
    summaryYears: "Titles rated up to age {{age}}.",
    summaryNone: "No age limit.",
    summaryCustom: "“{{names}}”, set on the desktop app or the web.",
    summaryCustomUnnamed: "A rating set on the desktop app or the web.",
    ceilingMember: "The administrator already limits this account to “{{names}}”: nothing beyond.",
    ceilingGuest: "The account that created this profile is limited to “{{names}}”: nothing beyond.",
    ceilingGuestNamed: "{{creator}}'s account is limited to “{{names}}”: nothing beyond.",
    selected: "selected",
  },
  libraries: {
    title: "Libraries",
    all: "All",
    count: "{{on}} of {{total}}",
    empty: "No library to set.",
    allowed: "allowed",
    hidden: "hidden",
    keepOne: "Keep at least one library.",
  },
  more: {
    title: "More options on the desktop app or the web",
    detail: "Unrated titles, tags, time limits.",
  },
  saving: "Saving…",
  saved: "Saved — Jellyfin applies it.",
  loadFailed: "Couldn't read this profile's parental controls.",
  unavailable: "This server doesn't allow setting this profile from the TV.",
};
