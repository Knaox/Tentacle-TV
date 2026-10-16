import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { NavigationProp } from "@react-navigation/native";
import type { ManageCapability } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { GUEST_PHOTO_ROUTE, PARENTAL_ROUTE, routeDeclared } from "./manageRoutes";
import { useFamilyCapability } from "./useFamilyCapability";

/**
 * Ce que la fiche d'un profil peut proposer ICI : ce que le serveur sait
 * faire (ses capacités — jamais un numéro de version), et ce que cette TV
 * sait montrer (la galerie, l'écran du contrôle parental). Un geste absent
 * de l'un ou de l'autre n'est pas proposé (tv-core `familyManageSheet`).
 */
export function useManageCapability(enabled: boolean, navigation: NavigationProp<RootStackParamList>): ManageCapability {
  const family = useFamilyCapability(enabled);
  const { capabilities } = useServerCapabilities();
  const gallery = routeDeclared(navigation, GUEST_PHOTO_ROUTE);
  const parental = routeDeclared(navigation, PARENTAL_ROUTE);
  return {
    guestRequests: family?.guestRequests === true,
    guestPhotos: gallery && capabilities.has("family.guestPhotos"),
    roles: capabilities.has("family.roles"),
    guestParental: parental && capabilities.has("family.parentalControls"),
    memberParental: parental && capabilities.has("family.memberParental"),
  };
}
