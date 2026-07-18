import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { Dropdown } from "./ui/Dropdown";
import { AVATAR_RING_STYLE, buildUserMenuItems, getUserInfo } from "./userMenu/menuItems";
import { useAvatarUpload } from "../hooks/useAvatarUpload";
import { useToast } from "../contexts/ToastContext";

/**
 * Bouton avatar + dropdown menu pour le desktop (TopNav).
 * L'en-tête du menu affiche la photo de profil Jellyfin (fallback initiale) ;
 * cliquer dessus permet d'en choisir une nouvelle — envoyée à Jellyfin, elle
 * change aussi dans les autres clients. Équivalent mobile : `MobileUserSheet`
 * (le changement de photo mobile vit sur la page Profil).
 */
export function UserAvatarMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("nav");
  const { t: tProfile } = useTranslation("profile");
  const { show } = useToast();
  const { logout } = useAuth();
  const { name, initial, isAdmin } = getUserInfo();
  const { avatarUrl, avatarVersion, uploading, upload } = useAvatarUpload();
  const [imageFailed, setImageFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const handleLogout = useCallback(() => {
    close();
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }, [logout, navigate, close]);

  const navigateTo = useCallback((path: string) => {
    close();
    navigate(path);
  }, [close, navigate]);

  const handleFile = useCallback(async (file: File) => {
    const ok = await upload(file);
    if (ok) setImageFailed(false);
    show(ok ? "success" : "error", tProfile(ok ? "avatarUpdated" : "avatarUpdateFailed"));
    if (fileRef.current) fileRef.current.value = "";
  }, [upload, show, tProfile]);

  const items = buildUserMenuItems({
    t,
    isAdmin,
    navigate: navigateTo,
    handleLogout,
  });

  const showImage = !!avatarUrl && !imageFailed;
  const avatarContent = showImage ? (
    <img
      key={avatarVersion}
      src={avatarUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setImageFailed(true)}
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
        style={AVATAR_RING_STYLE}
      >
        {avatarContent}
      </button>

      <Dropdown open={open} onClose={close} placement="bottom-end" minWidth={224}>
        {/* En-tête profil : avatar cliquable = changer la photo (Jellyfin) */}
        <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={tProfile("changePhoto")}
            title={tProfile("changePhoto")}
            className="group relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-cta-brand-fg"
            style={AVATAR_RING_STYLE}
          >
            {avatarContent}
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
            <p className="text-xs text-content-quaternary">{tProfile("changePhoto")}</p>
          </div>
        </div>

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
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
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
      </Dropdown>

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

function CameraIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
