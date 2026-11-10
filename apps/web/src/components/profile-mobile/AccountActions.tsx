import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { HardDrivesIcon } from "@phosphor-icons/react/dist/csr/HardDrives";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { isDesktopApp } from "../../desktop/bridge";
import { useActiveProfile } from "../../auth/profileSession";
import { clearLocalCache } from "../../lib/clearLocalCache";
import { LogoutIcon } from "../userMenu/icons";

/**
 * Section "Compte" sur MobileProfile : changer de serveur (Tauri uniquement),
 * vider le cache, déconnexion (danger). Confirme avant chaque action.
 *
 * Bureau, session d'un PROFIL (fenêtre étroite) : ni déconnexion du compte ni
 * changement de serveur — comme le menu de l'avatar, on revient d'abord à son
 * propre profil ; vider le cache garde la session du profil ET la réserve du
 * compte (`clearLocalCache`).
 */
export function AccountActions() {
  const { t } = useTranslation("profile");
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"logout" | "cache" | "server" | null>(null);
  const profileSession = useActiveProfile() !== null;

  const handleLogout = useCallback(() => {
    if (busy) return;
    if (!confirm(tNav("logoutConfirmMessage"))) return;
    setBusy("logout");
    logout.mutate(undefined, {
      onSuccess: () => navigate("/login"),
      onSettled: () => setBusy(null),
    });
  }, [busy, logout, navigate, tNav]);

  const handleClearCache = useCallback(() => {
    if (busy) return;
    // La session et le serveur restent (`clearLocalCache`) : la phrase du web, pas celle du mobile.
    if (!confirm(t("clearCacheKeepsSessionMessage"))) return;
    setBusy("cache");
    try {
      qc.clear();
      clearLocalCache(localStorage);
      window.location.reload();
    } catch {
      setBusy(null);
    }
  }, [busy, qc, t]);

  const handleChangeServer = useCallback(() => {
    if (busy) return;
    if (!confirm(t("changeServerMessage"))) return;
    setBusy("server");
    localStorage.removeItem("tentacle_server_url");
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
    window.location.reload();
  }, [busy, t]);

  return (
    <section
      className="ui-panel overflow-hidden"
      aria-label={t("title")}
    >
      <ul className="divide-y divide-line-subtle">
        {isDesktopApp() && !profileSession && (
          <li>
            <button
              type="button"
              onClick={handleChangeServer}
              disabled={busy !== null}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] text-content-secondary transition-colors duration-hover hover:bg-fill-faint active:bg-fill-subtle disabled:opacity-50"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-fill-soft text-content-secondary">
                <HardDrivesIcon aria-hidden size={20} />
              </span>
              <span className="flex-1">{t("changeServer")}</span>
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            onClick={handleClearCache}
            disabled={busy !== null}
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] text-content-secondary transition-colors duration-hover hover:bg-fill-faint active:bg-fill-subtle disabled:opacity-50"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-fill-soft text-content-secondary">
              <TrashIcon aria-hidden size={20} />
            </span>
            <span className="flex-1">{t("clearCache")}</span>
          </button>
        </li>
        {!profileSession && (
          <li>
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy !== null}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] font-medium text-status-error-fg transition-colors duration-hover hover:bg-fill-faint active:bg-status-error-bg disabled:opacity-50"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-status-error-bg">
                <LogoutIcon />
              </span>
              <span className="flex-1">{tNav("logout")}</span>
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
