/**
 * Family — words SHARED by every client (web, desktop, mobile, Apple TV):
 * roles, invitation poster, bell, server refusals (one per code of
 * `family/familyContract.ts`). Each client's screens add their own apart.
 * Read by mobile: the word "download" never appears here.
 */
export default {
  kindOwner: "Owner",
  kindMember: "Member",
  kindGuest: "Guest",
  guestOf: "Guest · {{owner}}'s family",
  poster: {
    title: "{{owner}} invites you to join their family",
    profile: "Your profile will open on {{owner}}'s TVs without a password, unless you set a PIN code.",
    leave: "You can leave the family at any time.",
    accept: "Accept",
    decline: "Decline",
    later: "Later",
  },
  notifications: {
    family_invite: "{{name}} invites you to join their family",
    family_invite_accepted: "{{name}} joined your family",
    family_invite_declined: "{{name}} declined your invitation",
    family_member_left: "{{name}} left your family",
    family_member_removed: "{{name}} removed you from their family",
    family_dissolved: "{{name}} dissolved their family",
  },
  errors: {
    invalid_input: "The request is incomplete or malformed.",
    pin_format: "A PIN code is exactly four digits.",
    candidate_invalid: "This account can't be invited.",
    pairing_required: "This TV needs to be paired again.",
    disabled: "Families are turned off on this server.",
    guests_disabled: "Guest profiles are turned off on this server.",
    personal_session_required: "Do this from your own session: the web, the desktop app or mobile.",
    not_owner: "Only the family owner can do this.",
    manage_locked: "Enter the owner's PIN code to manage profiles.",
    guest_account: "A guest profile can't create or join a family.",
    review_account: "Not available on the demo account.",
    pin_required: "This profile is protected by a PIN code.",
    pin_invalid: "Wrong PIN code.",
    not_found: "Not found: this no longer exists.",
    full: "The family is full: six profiles at most, owner included.",
    guests_full: "Three guest profiles at most per family.",
    already_member: "This account is already part of the family.",
    invite_pending: "An invitation is already waiting for this account's answer.",
    invite_closed: "This invitation is no longer valid.",
    invite_expired: "This invitation has expired.",
    enroll_required: "This TV must switch to profiles first.",
    profile_unavailable: "This profile is no longer available on this TV.",
    pin_locked: "Too many attempts: try again later.",
    invite_cooldown: "This account recently declined your invitation: try again later.",
    invite_quota: "Too many invitations for now: try again later.",
    guest_quota: "Too many guest profiles created today: try again later.",
    jellyfin_refused: "Jellyfin refused the operation.",
    jellyfin_unavailable: "Jellyfin isn't responding: try again in a moment.",
  },
} as const;
