// La Famille : les appels de la session courante (web, bureau, mobile, et la
// gestion des profils du propriétaire sur sa TV), ceux du jeton de jumelage de
// l'Apple TV, les crochets et le temps réel. Contrat : @tentacle-tv/shared › family/.
export {
  familyErrorFromApi, fetchFamilyOverview, fetchFamilyCandidates, createFamilyGuest, deleteFamilyGuest,
  setFamilyGuestPin, setOwnFamilyPin, removeFamilyMember, setFamilyMemberRights, sendFamilyInvitation, cancelFamilyInvitation,
  acceptFamilyInvitation, declineFamilyInvitation, snoozeFamilyInvitation, leaveFamily, dissolveFamily,
} from "../family/familyApi";
export {
  enrollTvProfiles, fetchTvProfiles, openTvProfileSession, unlockTvManage, endTvToken, type TvFamilyCall,
} from "../family/familyTvApi";
export {
  FAMILY_KEY, FAMILY_OVERVIEW_KEY, familyCandidatesKey, useFamilyOverview, useFamilyCandidates,
  useCreateFamilyGuest, useDeleteFamilyGuest, useSetFamilyGuestPin, useSetOwnFamilyPin, useRemoveFamilyMember, useSetFamilyMemberRights,
  useSendFamilyInvitation, useCancelFamilyInvitation, useAcceptFamilyInvitation, useDeclineFamilyInvitation,
  useSnoozeFamilyInvitation, useLeaveFamily, useDissolveFamily,
} from "../hooks/useFamily";
export { useFamilyLive, type UseFamilyLiveOptions } from "../hooks/useFamilyLive";
// L'administration : les interrupteurs « Familles » et « Profils invités ».
export { fetchFamilySwitches, setFamilySwitches } from "../family/familyAdminApi";
export { FAMILY_SWITCHES_KEY, useFamilySwitches, useSetFamilySwitches } from "../hooks/useFamilyAdmin";
