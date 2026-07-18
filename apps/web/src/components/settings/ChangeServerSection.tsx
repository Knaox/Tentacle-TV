import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { useAuth } from "@tentacle-tv/api-client";

import { ConfirmDialog } from "../ui/ConfirmDialog";

/**
 * Changement de serveur — desktop uniquement.
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
      <SettingsSection title={t("profile:changeServerTitle")}>
        <SettingsRow
          icon={<Server size={17} />}
          label={t("profile:changeServer")}
          description={t("profile:changeServerMessage")}
          onClick={() => setConfirming(true)}
          disabled={changeServer.isPending}
          chevron
          last
        />
      </SettingsSection>

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
