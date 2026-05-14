import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { Dropdown } from "./ui/Dropdown";
import { AVATAR_RING_STYLE, buildUserMenuItems, getUserInfo } from "./userMenu/menuItems";

/**
 * Bouton avatar + dropdown menu pour le desktop (TopNav).
 * Pour l'équivalent mobile : voir `MobileUserSheet`.
 */
export function UserAvatarMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("nav");
  const { logout } = useAuth();
  const { initial, isAdmin } = getUserInfo();

  const close = useCallback(() => setOpen(false), []);

  const handleLogout = useCallback(() => {
    close();
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }, [logout, navigate, close]);

  const navigateTo = useCallback((path: string) => {
    close();
    navigate(path);
  }, [close, navigate]);

  const items = buildUserMenuItems({
    t,
    isAdmin,
    navigate: navigateTo,
    handleLogout,
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={t("preferences")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
        style={AVATAR_RING_STYLE}
      >
        {initial}
      </button>

      <Dropdown open={open} onClose={close} placement="bottom-end" minWidth={224}>
        <div className="py-1.5">
          {items.map((item, idx) => {
            const isLogout = item.danger === true;
            const showDivider = isLogout && idx > 0 && !items[idx - 1].danger;
            return (
              <div key={item.key}>
                {showDivider && <div className="my-1.5 border-t border-white/[0.06]" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={item.action}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
                    isLogout
                      ? "text-[color:var(--status-error-fg)] hover:bg-[color:var(--status-error-bg)]"
                      : "text-white/75 hover:bg-white/5 hover:text-white"
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
    </div>
  );
}
