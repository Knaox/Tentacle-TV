import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dropdown } from "./ui/Dropdown";
import { avatarRingStyleFor, buildUserMenuGroups, getUserInfo, menuProfileItems } from "./userMenu/menuItems";
import { useAvatarUpload } from "../hooks/useAvatarUpload";
import { isDesktopApp } from "../desktop/bridge";
import { useConnectivity } from "../offline/useConnectivity";
import { setManualOffline } from "../offline/connectivityStore";
import { useOfflineMode } from "../offline/useOfflineMode";
import { useDownloadsVisibility } from "../downloads/useDownloadState";
import { useActiveProfile } from "../auth/profileSession";
import { useAccountLogout } from "../auth/useAccountLogout";
import { FamilyAvatar } from "../family/FamilyAvatar";
import { useProfileMenuItems } from "../profiles/switcher/useProfileMenuItems";
import { useAccountFaceColor } from "../profiles/face/useAccountFaceColor";
import { ProfileMenuHeader } from "./userMenu/ProfileMenuHeader";
import { AccountHeader } from "./userMenu/AccountHeader";
import { MenuRow, UserMenuGroups } from "./userMenu/UserMenuGroups";
import { useMenuKeyboard } from "./userMenu/useMenuKeyboard";
import { useAvatarGallery } from "../profiles/avatarGallery/useAvatarGallery";
import { useGuestSessionPhoto } from "../profiles/avatarGallery/useGuestSessionPhoto";

/**
 * Bouton avatar + dropdown menu pour le desktop (TopNav).
 * L'en-tête du menu affiche la photo de profil Jellyfin (fallback initiale) ;
 * cliquer dessus ouvre la galerie des avatars (`useAvatarGallery`) — un
 * personnage de la troupe ou une photo importée, envoyés à Jellyfin : la photo
 * change aussi dans les autres clients. Équivalent mobile : `MobileUserSheet`
 * (le changement de photo mobile vit sur la page Profil).
 *
 * Le menu, de haut en bas : le bloc d'IDENTITÉ (photo, nom ; bureau, famille
 * d'au moins deux profils : « Changer de profil » juste dessous, qui ouvre
 * « Qui regarde ? » plein écran — une entrée, jamais la liste des profils,
 * `useProfileMenuItems` ; « Gérer les profils » est sur cet écran et dans
 * Paramètres › Famille, plus dans le menu), puis les familles courtes de
 * `buildUserMenuGroups` (`UserMenuGroups`) : moi, cet appareil, et un pied
 * « Aide · À propos » — « Déconnexion ». Pendant la session d'un profil, le
 * bouton et l'en-tête sont les siens (sa couleur, son nom), et le menu tait
 * ce que le serveur lui refuse (`buildUserMenuItems` › `profileSession`). En
 * session personnelle, le rond prend la couleur du profil du compte, celle de
 * « Qui regarde ? » (`useAccountFaceColor`) ; sans famille, la marque.
 * Flèches Haut et Bas d'une entrée à l'autre (`useMenuKeyboard`).
 */
export function UserAvatarMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("nav");
  const { t: tProfile } = useTranslation("profile");
  const logoutAccount = useAccountLogout();
  const { name, initial, isAdmin } = getUserInfo();
  const connectivity = useConnectivity();
  const offline = useOfflineMode();
  const { avatarSrc, onAvatarError, avatarVersion, uploading } = useAvatarUpload();
  // Le catalogue local : visible dès qu'il y a un droit ou du contenu.
  const { visible: onDeviceVisible } = useDownloadsVisibility();
  const activeProfile = useActiveProfile();
  const ringStyle = avatarRingStyleFor(useAccountFaceColor());

  const close = useCallback(() => setOpen(false), []);
  // L'écran « Qui regarde ? » refermé, le focus revient à l'avatar.
  const avatarRef = useRef<HTMLButtonElement>(null);
  const profileItems = menuProfileItems(useProfileMenuItems(close, avatarRef));
  const menuKeys = useMenuKeyboard(open);

  const handleLogout = useCallback(() => {
    close();
    logoutAccount(() => navigate("/login"));
  }, [logoutAccount, navigate, close]);

  const navigateTo = useCallback((path: string) => {
    close();
    navigate(path);
  }, [close, navigate]);

  const { openGallery, dialog: galleryDialog } = useAvatarGallery();
  const changePhoto = useCallback(() => {
    close();
    openGallery();
  }, [close, openGallery]);
  // Session d'un invité que l'appareil peut habiller : sa photo, par la session personnelle.
  const guestTarget = useGuestSessionPhoto();
  const changeGuestPhoto = useCallback(() => {
    if (!guestTarget) return;
    close();
    openGallery(guestTarget);
  }, [close, openGallery, guestTarget]);

  // Bascule manuelle hors ligne : desktop uniquement, et seulement quand tout
  // va bien (hors ligne, la pastille du TopNav porte déjà l'action inverse).
  const goOffline =
    isDesktopApp() && connectivity.state === "online"
      ? () => {
          close();
          setManualOffline(true);
        }
      : undefined;

  const groups = buildUserMenuGroups({
    t,
    isAdmin,
    navigate: navigateTo,
    handleLogout,
    goOffline,
    offline,
    onDevice: onDeviceVisible,
    profileSession: activeProfile ? { guest: activeProfile.kind === "guest" } : null,
  });

  // `avatarSrc` retombe tout seul sur la copie locale hors ligne, puis sur
  // l'initiale s'il n'y en a aucune (cf. `useAvatarUpload`). Un profil : son rond.
  const avatarContent = activeProfile ? (
    <FamilyAvatar userId={activeProfile.id} name={activeProfile.name} color={activeProfile.color} imageTag={activeProfile.imageTag} size={36} />
  ) : avatarSrc ? (
    <img
      key={`${avatarVersion}-${avatarSrc}`}
      src={avatarSrc}
      alt=""
      className="h-full w-full object-cover"
      onError={onAvatarError}
    />
  ) : (
    initial
  );

  return (
    <div className="relative">
      <button
        ref={avatarRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={t("preferences")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-cta-brand-fg transition-transform duration-200 hover:-translate-y-0.5"
        style={ringStyle}
      >
        {avatarContent}
      </button>

      <Dropdown open={open} onClose={close} placement="bottom-end" minWidth={260}>
        <div ref={menuKeys.panelRef} onKeyDown={menuKeys.onKeyDown}>
          {/* Le bloc d'identité : qui l'on est, et « Changer de profil » juste dessous. */}
          <div className={`border-b border-line-subtle ${profileItems.length > 0 ? "pb-1.5" : ""}`}>
            {activeProfile ? (
              <ProfileMenuHeader profile={activeProfile} onChangePhoto={guestTarget ? changeGuestPhoto : undefined} />
            ) : (
              <AccountHeader
                avatar={avatarContent}
                ringStyle={ringStyle}
                name={name}
                caption={tProfile("changePhoto")}
                uploading={uploading}
                onChangePhoto={changePhoto}
              />
            )}
            {profileItems.map((item) => <MenuRow key={item.key} item={item} />)}
          </div>

          <UserMenuGroups groups={groups} />
        </div>
      </Dropdown>

      {galleryDialog}
    </div>
  );
}
