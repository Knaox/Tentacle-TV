/**
 * Sharing your stats — the OWNER's panel (web, desktop, mirror, mobile).
 *
 * ⚠️ Also read by MOBILE: never "download" here.
 */
export default {
  button: "Share",
  title: "Share my stats",
  lead: "A public page anyone can open, no account needed. It shows your numbers and nothing else: no movie or show can be played from it.",

  periodLabel: "Shared period",
  period_30d: "Last 30 days",
  period_year: "This year",
  period_all: "All time",

  publicTitle: "What becomes public",
  public_time: "Your watch time, movies, episodes and viewing days",
  public_profile: "Your viewer profile and the broad times of day you watch",
  public_tastes: "Your genres, formats, decades, origins, dubbed or original",
  public_titles: "Your favorite movies, shows and top faces, with your ratings",
  public_records: "Your records, dated to the month",
  public_loves: "What you love",
  privateTitle: "Stays private",
  private_hours: "Your viewing hours, day by day",
  private_devices: "Your screens and apps",
  private_dates: "The exact dates of your sessions",
  private_place: "Your time zone",
  private_list: "My List and “To watch”",

  create: "Create the link",
  creating: "Creating the link…",
  linkActive: "Link active · {{period}}",
  preview: "View the public page",
  shareLink: "Share the link",
  periodSaved: "Link updated: {{period}}",
  periodSaving: "Updating the link…",

  revoke: "Revoke the link",
  revokeConfirmTitle: "Revoke this link?",
  revokeConfirmBody: "The public page will stop opening for everyone who has the link. You can create a new one afterwards.",
  revokeConfirm: "Revoke",
  cancel: "Cancel",
  revoked: "Link revoked: the public page no longer opens.",

  error: "Couldn't create the link. Try again in a moment.",
  revokeError: "Couldn't revoke the link. Try again in a moment.",
  outdated: "The server needs an update before you can share your stats.",
  shareFailed: "Couldn't share. The link is still shown: copy it.",
} as const;
