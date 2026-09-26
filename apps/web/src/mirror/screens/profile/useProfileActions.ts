import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@tentacle-tv/api-client";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { useToast } from "../../../contexts/ToastContext";

/** La confirmation en attente : une seule à la fois. */
export type ProfileConfirm = "changeServer" | "clearCache" | "deleteAccount" | null;

/** Ce que « Vider le cache » garde : la session et la langue (`AccountActions` du web). */
const KEEP_ON_CLEAR = new Set(["tentacle_server_url", "tentacle_token", "tentacle_user", "i18nextLng"]);

/**
 * `useProfileActions` de l'app : les quatre actions de compte (déconnexion,
 * changement de serveur, remise à zéro locale, suppression du compte). Les
 * gestes du web sont repris tels quels — `AccountActions` (cache),
 * `ChangeServerSection` (serveur), `OfflineBanner` (déconnexion qui aboutit
 * même sans réseau) ; la suppression suit l'app (`DELETE /api/auth/account`,
 * refusée à un administrateur, 403 côté serveur aussi). Les confirmations
 * passent par `ConfirmDialog` (jamais `window.confirm`, muet sous certains
 * webviews) ; les erreurs, par un toast.
 */
export function useProfileActions(isAdmin: boolean) {
  const { t } = useTranslation("profile");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { show } = useToast();
  const { logout, changeServer } = useAuth();
  const [confirm, setConfirm] = useState<ProfileConfirm>(null);
  const [busy, setBusy] = useState(false);

  const handleLogout = useCallback(() => {
    logout.mutate(undefined, { onSettled: () => navigate("/login") });
  }, [logout, navigate]);

  const askDeleteAccount = useCallback(() => {
    if (isAdmin) { show("error", t("deleteAccountAdminError")); return; }
    setConfirm("deleteAccount");
  }, [isAdmin, show, t]);

  const runConfirmed = useCallback(async () => {
    const kind = confirm;
    if (kind === "changeServer") {
      setConfirm(null);
      changeServer.mutate(undefined, { onSettled: () => window.location.reload() });
      return;
    }
    if (kind === "clearCache") {
      setConfirm(null);
      qc.clear();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !KEEP_ON_CLEAR.has(key)) localStorage.removeItem(key);
      }
      window.location.reload();
      return;
    }
    if (kind !== "deleteAccount") return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/account`, { method: "DELETE", headers: hdrs(), credentials: creds() });
      if (res.status === 403) { show("error", t("deleteAccountAdminError")); return; }
      if (!res.ok) { show("error", t("deleteAccountError")); return; }
      show("success", t("deleteAccountSuccess"));
      localStorage.removeItem("tentacle_token");
      localStorage.removeItem("tentacle_user");
      qc.clear();
      window.location.assign("/login");
    } catch {
      show("error", t("deleteAccountError"));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }, [confirm, changeServer, qc, show, t]);

  return {
    confirm,
    busy: busy || changeServer.isPending,
    setConfirm,
    runConfirmed,
    handleLogout,
    askChangeServer: useCallback(() => setConfirm("changeServer"), []),
    askClearCache: useCallback(() => setConfirm("clearCache"), []),
    askDeleteAccount,
  };
}

export type ProfileActions = ReturnType<typeof useProfileActions>;
