import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useActiveProfile } from "../auth/profileSession";
import { useAccountLogout } from "../auth/useAccountLogout";
import { avatarRingStyleFor, buildUserMenuGroups, getUserInfo, menuProfileItems, type UserMenuItem } from "./userMenu/menuItems";
import { MENU_GROUP_LABEL_KEYS } from "./userMenu/UserMenuGroups";
import { useAccountFaceColor } from "../profiles/face/useAccountFaceColor";
import { useProfileMenuItems } from "../profiles/switcher/useProfileMenuItems";

interface Props {
  onClose: () => void;
}

/**
 * Bottom sheet mobile pour les actions utilisateur. Pendant mobile du
 * `UserAvatarMenu` desktop ; mêmes familles (`buildUserMenuGroups` : moi,
 * cet appareil, aide — crédits compris ici —, déconnexion), séparées d'un
 * filet. Bureau en fenêtre étroite, famille : « Changer de profil » sous
 * l'en-tête, comme dans le menu de l'avatar (`useProfileMenuItems` ;
 * « Gérer les profils » est sur « Qui regarde ? »).
 *
 * Animations alignées sur `PlusMenu` pour la cohérence visuelle.
 */
export function MobileUserSheet({ onClose }: Props) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const logoutAccount = useAccountLogout();
  const activeProfile = useActiveProfile();
  const { name, initial, isAdmin } = getUserInfo();
  const ringStyle = avatarRingStyleFor(useAccountFaceColor());
  const overlayRef = useRef<HTMLDivElement>(null);
  const profileItems = menuProfileItems(useProfileMenuItems(onClose));

  const handleLogout = useCallback(() => {
    onClose();
    logoutAccount(() => navigate("/login"));
  }, [logoutAccount, navigate, onClose]);

  const navigateTo = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const groups = buildUserMenuGroups({
    t,
    isAdmin,
    navigate: navigateTo,
    handleLogout,
    extended: true, // inclut Crédits sur mobile
    profileSession: activeProfile ? { guest: activeProfile.kind === "guest" } : null,
  });
  const regularGroups = groups.filter((group) => group.key !== "session");
  const dangerItems = groups.find((group) => group.key === "session")?.items ?? [];

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ animation: "sheetOverlayIn 200ms ease forwards" }}
      role="dialog"
      aria-modal="true"
      aria-label={t("profile")}
    >
      {/* Voile derrière la sheet : reste sombre dans les deux thèmes (règle scrim de modale). */}
      <style>{`
        @keyframes sheetOverlayIn { from { background: transparent; } to { background: rgba(0,0,0,0.5); } }
        @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line-subtle safe-area-pb"
        style={{
          // Fond du panneau : littéral hors table de correspondance (ni bg-white/*
          // ni bg-black/*) — implémentation ad hoc antérieure au primitive Sheet
          // (qui utilise déjà var(--surface-sheet), adaptatif). Non migré ici :
          // wiring vers surface-sheet hors périmètre de cette passe.
          background: "rgba(12,12,22,0.98)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          animation: "sheetSlideUp 300ms cubic-bezier(0.32,0.72,0,1) forwards",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-fill-medium" aria-hidden />
        </div>

        {/* Header utilisateur */}
        <div className="flex items-center gap-4 px-5 pb-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-cta-brand-fg"
            style={ringStyle}
            aria-hidden
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-content-primary">
              {name || t("profile")}
            </p>
            {isAdmin && (
              <span
                className="mt-1 inline-flex items-center rounded-full border border-[rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.15)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-light)]"
              >
                {t("admin")}
              </span>
            )}
          </div>
        </div>

        <div className="mx-5 mb-2 h-px bg-fill-soft" aria-hidden />

        {/* Les profils (bureau, famille) : « Changer de profil ». */}
        {profileItems.length > 0 && (
          <>
            <div className="pb-2">
              {profileItems.map((item) => <SheetRow key={item.key} item={item} />)}
            </div>
            <div className="mx-5 mb-2 h-px bg-fill-soft" aria-hidden />
          </>
        )}

        {/* Les familles : moi, cet appareil, aide — un filet entre chacune. */}
        {regularGroups.map((group, index) => {
          const labelKey = MENU_GROUP_LABEL_KEYS[group.key];
          return (
            <div key={group.key}>
              {index > 0 && <div className="mx-5 my-2 h-px bg-fill-soft" aria-hidden />}
              <div role="group" aria-label={labelKey ? t(labelKey) : undefined}>
                {group.items.map((item) => <SheetRow key={item.key} item={item} />)}
              </div>
            </div>
          );
        })}

        {/* Séparateur avant logout */}
        {dangerItems.length > 0 && <div className="mx-5 my-2 h-px bg-fill-soft" aria-hidden />}

        {/* Logout (danger) */}
        <div className="pb-4">
          {dangerItems.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={item.action}
              className="flex w-full items-center gap-4 px-5 py-3 text-left text-[15px] font-medium text-[color:var(--status-error-fg)] transition-colors duration-150 active:bg-[color:var(--status-error-bg)]"
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Une entrée de la feuille : pictogramme, libellé, chevron. */
function SheetRow({ item }: { item: UserMenuItem }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={item.action}
      className="flex w-full items-center gap-4 px-5 py-3 text-left text-[15px] text-content-secondary transition-colors duration-150 active:bg-fill-subtle"
    >
      <span className="flex-shrink-0 text-content-tertiary">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      <span className="flex-shrink-0 text-content-quaternary" aria-hidden>›</span>
    </button>
  );
}
