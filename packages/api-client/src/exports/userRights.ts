// Les droits des comptes (administration, web et bureau) et le contrôle
// parental des invités de la Famille. Contrat : @tentacle-tv/shared › userRights/
// et family/familyParental.ts (docs/DROITS-UTILISATEURS.md).
export {
  fetchUserRightsOptions, fetchUserRights, patchUserRights, fetchFamilyParentalOptions, setFamilyGuestParental,
  userRightsRefusalOf,
} from "../userRights/userRightsApi";
export {
  USER_RIGHTS_KEY, USER_RIGHTS_OPTIONS_KEY, userRightsKey, ADMIN_DOWNLOAD_RIGHTS_KEY, FAMILY_PARENTAL_OPTIONS_KEY,
  useUserRightsOptions, useUserRights, useUpdateUserRights, useFamilyParentalOptions, useSetFamilyGuestParental,
} from "../userRights/useUserRights";
// « Accès à Octave » : le droit Tentacle d'un compte au mode musique (capacité `octave.rights`).
export {
  octaveRightsKey, fetchOctaveRights, setOctaveRights, useOctaveRights, useSetOctaveRights,
} from "../userRights/useOctaveRights";
