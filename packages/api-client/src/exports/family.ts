// La Famille : les appels de la session courante (web, bureau, mobile, et la
// gestion des profils du propriétaire sur sa TV), ceux du jeton de jumelage de
// l'Apple TV, les crochets et le temps réel. Contrat : @tentacle-tv/shared › family/.
export {
  familyErrorFromApi, fetchFamilyOverview, fetchFamilyCandidates, createFamilyGuest, deleteFamilyGuest,
  setFamilyGuestPin, setFamilyGuestPhoto, setOwnFamilyPin, removeFamilyMember, setFamilyMemberRights, setFamilyGuestRights, sendFamilyInvitation, cancelFamilyInvitation,
  acceptFamilyInvitation, declineFamilyInvitation, snoozeFamilyInvitation, leaveFamily, dissolveFamily, unlockFamilyManage,
} from "../family/familyApi";
export {
  enrollTvProfiles, fetchTvProfiles, openTvProfileSession, unlockTvManage, endTvToken, type TvFamilyCall,
} from "../family/familyTvApi";
// « Qui regarde ? » sur le bureau : toujours le jeton de la session PERSONNELLE.
export {
  fetchPickerProfiles, pickFamilyProfile, fetchPickerPreference, setPickerPreference, setPickerGuestPhoto, type PickerCall,
} from "../family/familyPickerApi";
export {
  FAMILY_KEY, FAMILY_OVERVIEW_KEY, familyCandidatesKey, useFamilyOverview, useFamilyCandidates,
  useCreateFamilyGuest, useDeleteFamilyGuest, useSetFamilyGuestPin, useSetFamilyGuestPhoto, useSetOwnFamilyPin, useRemoveFamilyMember, useSetFamilyMemberRights, useSetFamilyGuestRights,
  useSendFamilyInvitation, useCancelFamilyInvitation, useAcceptFamilyInvitation, useDeclineFamilyInvitation,
  useSnoozeFamilyInvitation, useLeaveFamily, useDissolveFamily, useUnlockFamilyManage,
} from "../hooks/useFamily";
export { useFamilyLive, type UseFamilyLiveOptions } from "../hooks/useFamilyLive";
// L'administration : les interrupteurs « Familles » et « Profils invités ».
export { fetchFamilyLaunchPolicy, fetchFamilySwitches, setFamilyLaunchPolicy, setFamilySwitches } from "../family/familyAdminApi";
export {
  FAMILY_LAUNCH_POLICY_KEY,
  FAMILY_SWITCHES_KEY,
  useFamilyLaunchPolicy,
  useFamilySwitches,
  useSetFamilyLaunchPolicy,
  useSetFamilySwitches,
} from "../hooks/useFamilyAdmin";
// Parents, membres mineurs et droits de création (serveur 1.30.0).
export {
  setFamilyMemberRole, setFamilyMemberParental, fetchFamilyCreationDefaults, setFamilyCreationDefaults,
  fetchAccountFamilyRights, setAccountFamilyRights,
} from "../family/familyRolesApi";
export {
  FAMILY_CREATION_DEFAULTS_KEY, accountFamilyRightsKey, useSetFamilyMemberRole, useSetFamilyMemberParental,
  useFamilyCreationDefaults, useSetFamilyCreationDefaults, useAccountFamilyRights, useSetAccountFamilyRights,
} from "../hooks/useFamilyRoles";
// Les bibliothèques permises à un invité ou à un membre mineur (serveur 1.30.0, `family.libraryLimits`).
export { fetchFamilyLibraries, setFamilyLibraries } from "../family/familyLibrariesApi";
export { familyLibrariesKey, useFamilyLibraries, useSetFamilyLibraries } from "../hooks/useFamilyLibraries";
