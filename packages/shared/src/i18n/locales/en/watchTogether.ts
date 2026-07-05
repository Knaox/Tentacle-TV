export default {
  // Header / panel
  title: "Watch Together",
  createGroup: "Create a group",
  creating: "Creating…",
  yourGroup: "Your group",
  membersCount: "{{count}} member",
  membersCount_other: "{{count}} members",
  host: "Host",
  you: "You",
  invite: "Invite",
  leaveGroup: "Leave group",
  kick: "Kick",
  online: "Online",
  offline: "Offline",
  watching: "Watching",
  bufferingStatus: "Buffering…",
  cantPlay: "Can't play this media",
  noGroup: "No active group.",
  noGroupHint: "Create a group and invite other users: everything you watch will stay perfectly in sync.",

  // Invitations
  invitations: "Invitations",
  invitedBy: "{{name}} invites you to watch together",
  invitedByWithItem: "{{name}} invites you to watch {{title}}",
  accept: "Accept",
  decline: "Decline",
  invitesSent: "Invitation sent",
  invitesSent_other: "{{count}} invitations sent",
  inviteAccepted: "{{name}} accepted the invitation",
  inviteDeclined: "{{name}} declined the invitation",
  selectUsers: "Invite users",
  searchUsers: "Search for a user…",
  noUsersFound: "No users found.",
  sendInvites: "Invite",
  sendInvitesCount: "Invite ({{count}})",
  cancel: "Cancel",

  // Media detail page
  watchTogetherAction: "Watch together",
  playInGroup: "Play in group",

  // Event toasts
  memberJoined: "{{name}} joined the group",
  memberLeft: "{{name}} left the group",
  memberKicked: "{{name}} was kicked from the group",
  youWereKicked: "You were kicked from the group",
  hostTransferred: "{{name}} is now the host",
  youAreHost: "You are now the host of the group",
  pausedBy: "{{name}} paused playback",
  resumedBy: "{{name}} resumed playback",
  seekedBy: "{{name}} changed the position",
  itemStartedBy: "{{name}} started playback",
  groupDissolved: "The group was dissolved",
  memberCantPlay: "{{name}} can't play this media",

  // Player overlay
  memberBuffering: "{{name}} is buffering…",
  membersBuffering: "{{count}} members are buffering…",
  waitingForGroup: "Waiting for the group…",

  // Floating pill
  groupPlaybackActive: "Group playback in progress",
  rejoin: "Rejoin",

  // Group chat
  chatTitle: "Group chat",
  chatPlaceholder: "Type a message…",
  chatSend: "Send",
  chatEmpty: "No messages yet. Say hi!",
  chatOpenAria: "Open group chat",
  chatUnreadAria: "Open group chat ({{count}} unread message)",
  chatUnreadAria_other: "Open group chat ({{count}} unread messages)",

  // Errors
  alreadyInGroup: "You are already in a group.",
  groupGone: "This group no longer exists.",
  inviteExpired: "This invitation is no longer valid.",
  errorGeneric: "Something went wrong.",
} as const;
