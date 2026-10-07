import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { suggestedPublicUrls, type RemoteAccessState } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { AdminNotice } from "../admin/kit";
import { servicesApi } from "../admin/services/servicesApi";
import { SERVICES_KEYS } from "../admin/services/servicesModel";
import { REMOTE_ACCESS_KEY } from "./remoteAccessApi";

/**
 * Sans mandataire : l'adresse publique de Tentacle, proposée d'après
 * l'adresse de la box et le VRAI port (`http://203.0.113.5:47300`) — un clic
 * l'enregistre (le « lien public » des Services). Le HTTP en clair est dit,
 * sans alarme : le HTTPS est conseillé, pas exigé.
 */
export function PublicLinkStep({ state, publicIp }: { state: RemoteAccessState; publicIp: string | null }) {
  const { t } = useTranslation("remoteAccess");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const suggested = suggestedPublicUrls({ proxy: "none", publicIp, hostPort: state.hostPort, jellyfinPort: state.jellyfinHostPort }).tentacle;

  const use = async (url: string) => {
    setStatus("saving");
    try {
      await servicesApi.savePublicUrl(url);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REMOTE_ACCESS_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.publicUrl }),
      ]);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="space-y-3">
      <AdminNotice tone="warning">{t("noneWarning")}</AdminNotice>
      <p className="text-sm font-semibold text-content-primary">{t("publicLinkTitle")}</p>
      <p className="text-sm text-content-tertiary" aria-live="polite">
        {status === "saved" ? t("publicUrlSaved") : status === "failed" ? t("saveFailed") : state.publicUrl ? t("publicUrlCurrent", { url: state.publicUrl }) : t("publicUrlNone")}
      </p>
      {suggested ? (
        suggested !== state.publicUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-subtle bg-fill-faint p-3">
            <span className="min-w-0 flex-1 text-sm text-content-secondary">
              {t("publicLinkSuggested")} <span className="break-all font-mono text-content-primary">{suggested}</span>
            </span>
            <button type="button" onClick={() => void use(suggested)} disabled={status === "saving"} className={cls.bbrand}>
              {status === "saving" ? t("saving") : t("publicLinkUse")}
            </button>
          </div>
        ) : null
      ) : (
        <p className="text-sm text-content-tertiary">{t("publicLinkNoIp")}</p>
      )}
      <p className="text-xs leading-relaxed text-content-quaternary">{t("publicLinkDynamic")}</p>
    </div>
  );
}
