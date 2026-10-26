import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tentacle-tv/api-client";

import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SettingItem } from "./wide/SettingItem";
import { SETTING_BUTTON } from "./wide/settingButtons";

/**
 * Changement de serveur — app de bureau uniquement (Réglages › Compte et
 * sécurité › Cet appareil : la ligne vaut pour cette application seule).
 *
 * La confirmation passe par `ConfirmDialog` et non `window.confirm()` : les
 * WKWebView de Tauri (macOS) n'implémentent pas les dialogues natifs, où
 * `confirm()` retourne false SANS RIEN AFFICHER (wry #460). L'action semblait
 * donc simplement ne pas répondre sur macOS.
 */
export function ChangeServerSection() {
  const { t } = useTranslation(["profile", "common"]);
  const { changeServer } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    setConfirming(false);
    changeServer.mutate(undefined, {
      onSettled: () => window.location.reload(),
    });
  };

  return (
    <>
      <SettingItem
        setting="changeServer"
        trailing={(
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={changeServer.isPending}
            className={SETTING_BUTTON}
          >
            {t("profile:changeServer")}
          </button>
        )}
      />

      <ConfirmDialog
        open={confirming}
        title={t("profile:changeServerTitle")}
        message={t("profile:changeServerMessage")}
        confirmLabel={t("profile:changeServer")}
        cancelLabel={t("common:cancel")}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
        pending={changeServer.isPending}
        danger
      />
    </>
  );
}
