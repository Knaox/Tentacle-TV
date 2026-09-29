// Watch Together (REST : composition du groupe + utilisateurs invitables)
export {
  fetchMyGroup, fetchMyInvites, createGroup, sendGroupInvites, respondToInvite,
  leaveGroup, kickGroupMember, useInvitableUsers, setWatchTogetherBackendUrl, WtApiError,
} from "../hooks/useWatchTogetherApi";

// Share link ("Partager ma liste")
export {
  useCreateShareLink, useMyShareLink, useRevokeShareLink, useSharedView, useSharedItem,
  setShareLinkBackendUrl, setShareLinkToken, type SharedListData, type SharedListItem, type ShareListKind, type SharedView,
} from "../hooks/useShareLink";

// Partager ses statistiques (lien du propriétaire)
export {
  useMyStatsShare, useSaveStatsShare, useRevokeStatsShare, statsShareFailure, STATS_SHARE_KEY, type StatsShareFailure,
} from "../hooks/useStatsShare";
