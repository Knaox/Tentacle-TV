import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { isTauriApp } from "../../main";
import { LogoutIcon } from "../userMenu/icons";

/**
 * Section "Compte" sur MobileProfile : changer de serveur (Tauri uniquement),
 * vider le cache, déconnexion (danger). Confirme avant chaque action.
 */
export function AccountActions() {
  const { t } = useTranslation("profile");
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"logout" | "cache" | "server" | null>(null);

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
    if (!confirm(t("clearCacheMessage"))) return;
    setBusy("cache");
    try {
      qc.clear();
      const keep = new Set(["tentacle_server_url", "tentacle_token", "tentacle_user", "i18nextLng"]);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && !keep.has(k)) localStorage.removeItem(k);
      }
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
      className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]"
      aria-label={t("title")}
    >
      <ul className="divide-y divide-white/[0.05]">
        {isTauriApp && (
          <li>
            <button
              type="button"
              onClick={handleChangeServer}
              disabled={busy !== null}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] text-white/85 transition-colors active:bg-white/[0.04] disabled:opacity-50"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/70">
                <ServerIcon />
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
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] text-white/85 transition-colors active:bg-white/[0.04] disabled:opacity-50"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/70">
              <TrashIcon />
            </span>
            <span className="flex-1">{t("clearCache")}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={handleLogout}
            disabled={busy !== null}
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] font-medium text-[color:var(--status-error-fg)] transition-colors active:bg-[color:var(--status-error-bg)] disabled:opacity-50"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--status-error-bg)]">
              <LogoutIcon />
            </span>
            <span className="flex-1">{tNav("logout")}</span>
          </button>
        </li>
      </ul>
    </section>
  );
}

function ServerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
