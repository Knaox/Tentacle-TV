// Watch Together (REST : composition du groupe + utilisateurs invitables)
export {
  fetchMyGroup, fetchMyInvites, createGroup, sendGroupInvites, respondToInvite,
  leaveGroup, kickGroupMember, useInvitableUsers, setWatchTogetherBackendUrl, WtApiError,
  setWatchTogetherToken, fetchGroupElsewhere, joinGroupHere, arriveInGroup,
} from "../hooks/useWatchTogetherApi";

// Share link ("Partager ma liste")
export {
  useCreateShareLink, useMyShareLink, useRevokeShareLink, useSharedView, useSharedItem, usePublicSharingAllowed, shareErrorCode,
  setShareLinkBackendUrl, setShareLinkToken, type SharedListData, type SharedListItem, type ShareListKind, type SharedView,
} from "../hooks/useShareLink";

// Partager ses statistiques (lien du propriétaire)
export {
  useMyStatsShare, useSaveStatsShare, useRevokeStatsShare, statsShareFailure, STATS_SHARE_KEY, type StatsShareFailure,
} from "../hooks/useStatsShare";
// L'accès du compte à Watch Together (SyncPlayAccess, capacité `watchTogether.access`).
export { useWatchTogetherAccess, WT_ACCESS_KEY, type WatchTogetherAccessState } from "../rights/useWatchTogetherAccess";
