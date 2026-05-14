import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { AVATAR_RING_STYLE, buildUserMenuItems, getUserInfo } from "./userMenu/menuItems";

interface Props {
  onClose: () => void;
}

/**
 * Bottom sheet mobile pour les actions utilisateur (préférences, admin,
 * jumelage, à propos, aide, crédits, déconnexion). Pendant mobile du
 * `UserAvatarMenu` desktop ; partage la même liste d'items via `menuItems.tsx`.
 *
 * Animations alignées sur `PlusMenu` pour la cohérence visuelle.
 */
export function MobileUserSheet({ onClose }: Props) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { name, initial, isAdmin } = getUserInfo();
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleLogout = useCallback(() => {
    onClose();
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }, [logout, navigate, onClose]);

  const navigateTo = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const items = buildUserMenuItems({
    t,
    isAdmin,
    navigate: navigateTo,
    handleLogout,
    extended: true, // inclut Crédits sur mobile
  });
  const regularItems = items.filter((item) => !item.danger);
  const dangerItems = items.filter((item) => item.danger);

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
      <style>{`
        @keyframes sheetOverlayIn { from { background: transparent; } to { background: rgba(0,0,0,0.5); } }
        @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 safe-area-pb"
        style={{
          background: "rgba(12,12,22,0.98)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          animation: "sheetSlideUp 300ms cubic-bezier(0.32,0.72,0,1) forwards",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
        </div>

        {/* Header utilisateur */}
        <div className="flex items-center gap-4 px-5 pb-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={AVATAR_RING_STYLE}
            aria-hidden
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">
              {name || t("profile")}
            </p>
            {isAdmin && (
              <span
                className="mt-1 inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300"
              >
                {t("admin")}
              </span>
            )}
          </div>
        </div>

        <div className="mx-5 mb-2 h-px bg-white/[0.08]" aria-hidden />

        {/* Items réguliers */}
        <div className="pb-2">
          {regularItems.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={item.action}
              className="flex w-full items-center gap-4 px-5 py-3 text-left text-[15px] text-white/85 transition-colors duration-150 active:bg-white/[0.06]"
            >
              <span className="flex-shrink-0 text-white/60">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="flex-shrink-0 text-white/30" aria-hidden>›</span>
            </button>
          ))}
        </div>

        {/* Séparateur avant logout */}
        <div className="mx-5 my-2 h-px bg-white/[0.08]" aria-hidden />

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
