import { useState, useCallback, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dropdown } from "./ui/Dropdown";
import { avatarRingStyleFor, buildUserMenuItems, getUserInfo } from "./userMenu/menuItems";
import { useAvatarUpload } from "../hooks/useAvatarUpload";
import { useToast } from "../contexts/ToastContext";
import { isDesktopApp } from "../desktop/bridge";
import { useConnectivity } from "../offline/useConnectivity";
import { setManualOffline } from "../offline/connectivityStore";
import { useOfflineMode } from "../offline/useOfflineMode";
import { useDownloadsVisibility } from "../downloads/useDownloadState";
import { useActiveProfile } from "../auth/profileSession";
import { useAccountLogout } from "../auth/useAccountLogout";
import { FamilyAvatar } from "../family/FamilyAvatar";
import { useProfileSwitcher } from "../profiles/switcher/useProfileSwitcher";
import { useAccountFaceColor } from "../profiles/face/useAccountFaceColor";
import { ProfileMenuHeader } from "./userMenu/ProfileMenuHeader";
import { useMenuKeyboard } from "./userMenu/useMenuKeyboard";

/**
 * Bouton avatar + dropdown menu pour le desktop (TopNav).
 * L'en-tête du menu affiche la photo de profil Jellyfin (fallback initiale) ;
 * cliquer dessus permet d'en choisir une nouvelle — envoyée à Jellyfin, elle
 * change aussi dans les autres clients. Équivalent mobile : `MobileUserSheet`
 * (le changement de photo mobile vit sur la page Profil).
 *
 * Bureau, famille d'au moins deux profils : le CHANGEMENT RAPIDE de profil en
 * tête du menu (`useProfileSwitcher`). Pendant la session d'un profil, le
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
  const { show } = useToast();
  const logoutAccount = useAccountLogout();
  const { name, initial, isAdmin } = getUserInfo();
  const connectivity = useConnectivity();
  const offline = useOfflineMode();
  const { avatarSrc, onAvatarError, avatarVersion, uploading, upload } = useAvatarUpload();
  // Le catalogue local : visible dès qu'il y a un droit ou du contenu.
  const { visible: onDeviceVisible } = useDownloadsVisibility();
  const fileRef = useRef<HTMLInputElement>(null);
  const activeProfile = useActiveProfile();
  const ringStyle = avatarRingStyleFor(useAccountFaceColor());

  const close = useCallback(() => setOpen(false), []);
  const switcher = useProfileSwitcher(close);
  const menuKeys = useMenuKeyboard(open);

  const handleLogout = useCallback(() => {
    close();
    logoutAccount(() => navigate("/login"));
  }, [logoutAccount, navigate, close]);

  const navigateTo = useCallback((path: string) => {
    close();
    navigate(path);
  }, [close, navigate]);

  const handleFile = useCallback(async (file: File) => {
    const ok = await upload(file);
    show(ok ? "success" : "error", tProfile(ok ? "avatarUpdated" : "avatarUpdateFailed"));
    if (fileRef.current) fileRef.current.value = "";
  }, [upload, show, tProfile]);

  // Bascule manuelle hors ligne : desktop uniquement, et seulement quand tout
  // va bien (hors ligne, la pastille du TopNav porte déjà l'action inverse).
  const goOffline =
    isDesktopApp() && connectivity.state === "online"
      ? () => {
          close();
          setManualOffline(true);
        }
      : undefined;

  const items = buildUserMenuItems({
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

      <Dropdown open={open} onClose={close} placement="bottom-end" minWidth={240}>
        <div ref={menuKeys.panelRef} onKeyDown={menuKeys.onKeyDown}>
          {activeProfile ? (
            <ProfileMenuHeader profile={activeProfile} />
          ) : (
            <AccountHeader
              avatar={avatarContent}
              ringStyle={ringStyle}
              name={name}
              caption={tProfile("changePhoto")}
              uploading={uploading}
              onChangePhoto={() => fileRef.current?.click()}
            />
          )}

          {switcher.section}

          <div className="py-1.5">
            {items.map((item, idx) => {
              const isLogout = item.danger === true;
              const showDivider = isLogout && idx > 0 && !items[idx - 1].danger;
              return (
                <div key={item.key}>
                  {showDivider && <div className="my-1.5 border-t border-line-subtle" />}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={item.action}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 focus-visible:bg-fill-subtle focus-visible:outline-none ${
                      isLogout
                        ? "text-[color:var(--status-error-fg)] hover:bg-[color:var(--status-error-bg)]"
                        : "text-content-secondary hover:bg-fill-subtle hover:text-content-primary"
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Dropdown>
      {switcher.overlays}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

interface AccountHeaderProps {
  avatar: React.ReactNode;
  ringStyle: CSSProperties;
  name: string;
  caption: string;
  uploading: boolean;
  onChangePhoto: () => void;
}

/** En-tête du compte : avatar cliquable = changer la photo (Jellyfin). */
function AccountHeader({ avatar, ringStyle, name, caption, uploading, onChangePhoto }: AccountHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
      <button
        type="button"
        onClick={onChangePhoto}
        disabled={uploading}
        aria-label={caption}
        title={caption}
        className="group relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-cta-brand-fg"
        style={ringStyle}
      >
        {avatar}
        {/* Scrim posé sur la photo de profil (image ou fallback) : reste noir/blanc
            dans les deux thèmes, cf. règle "posé sur une image". */}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {uploading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <CameraIcon />
          )}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{name || "—"}</p>
        <p className="text-xs text-content-quaternary">{caption}</p>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
