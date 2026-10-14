import { useMemo, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useActiveProfile } from "../../auth/profileSession";
import { useOfflineMode } from "../../offline/useOfflineMode";
import { ManageProfilesIcon, SwitchProfileIcon } from "../../components/userMenu/icons";
import type { UserMenuItem } from "../../components/userMenu/menuItems";
import { usePickerListing } from "../api/usePickerListing";
import { FAMILY_SETTINGS_PATH } from "../launch/ProfileLaunchScreen";
import { openSwitchScreen } from "./switchScreenStore";

/**
 * Les profils dans le menu de l'avatar (et la feuille de la fenêtre étroite) :
 * UNE entrée, « Changer de profil », qui ouvre « Qui regarde ? » plein écran
 * (`WhoIsWatchingHost`) — le même qu'à l'ouverture, PIN compris. Jamais la
 * liste des profils dans le menu : pas d'accès rapide (Damien, 14/10).
 *
 * Là dès deux profils, que « Qui regarde ? » s'ouvre au lancement ou non,
 * depuis la session personnelle comme depuis celle d'un autre profil — pour
 * revenir au sien, derrière son code. En session personnelle, « Gérer les
 * profils » la suit (Réglages › Famille). Rien hors du bureau, face à un
 * serveur sans `family.desktopProfiles`, hors ligne (changer de profil passe
 * par le serveur), ni pour une famille d'un seul profil.
 *
 * `returnFocus` : ce qui reprend le focus quand l'écran se referme (l'avatar).
 */
export function useProfileMenuItems(onMenuClose: () => void, returnFocus?: RefObject<HTMLElement | null>): UserMenuItem[] {
  const { t } = useTranslation("profilePicker");
  const navigate = useNavigate();
  const active = useActiveProfile();
  const offline = useOfflineMode();
  const { listing, enabled } = usePickerListing();
  const offered = enabled && !offline && listing.data?.pickerRequired === true && listing.data.profiles.length >= 2;
  const personal = active === null;

  return useMemo(() => {
    if (!offered) return [];
    const items: UserMenuItem[] = [{
      key: "switchProfile",
      label: t("switcher.title"),
      icon: <SwitchProfileIcon />,
      action: () => {
        onMenuClose();
        openSwitchScreen(returnFocus?.current ?? null);
      },
    }];
    if (personal) {
      items.push({
        key: "manageProfiles",
        label: t("manageProfiles"),
        icon: <ManageProfilesIcon />,
        action: () => {
          onMenuClose();
          navigate(FAMILY_SETTINGS_PATH);
        },
      });
    }
    return items;
  }, [offered, personal, t, onMenuClose, returnFocus, navigate]);
}
