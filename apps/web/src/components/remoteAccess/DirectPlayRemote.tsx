import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { directPlayIssues, suggestedPublicUrls, type RemoteAccessState } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { Field } from "../admin/services/Field";
import { SERVICES_KEYS } from "../admin/services/servicesModel";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { remoteAccessApi, REMOTE_ACCESS_KEY } from "./remoteAccessApi";
import { isValidLocalUrl } from "./lanAddress";

type DirectPlay = NonNullable<RemoteAccessState["directPlay"]>;

/**
 * La lecture directe HORS de la maison, facultative (capacité
 * `admin.remoteExposure`) : coupée, les vidéos passent par Tentacle ;
 * allumée, l'adresse publique de Jellyfin (proposée d'après l'adresse de la
 * box et son vrai port) est donnée aux applications. Les mêmes règles que la
 * section « Lecture directe » des Services.
 */
export function DirectPlayRemote({ state, directPlay, publicIp }: { state: RemoteAccessState; directPlay: DirectPlay; publicIp: string | null }) {
  const { t } = useTranslation("remoteAccess");
  const queryClient = useQueryClient();
  const suggested = suggestedPublicUrls({ proxy: state.settings.proxy, publicIp, hostPort: state.hostPort, jellyfinPort: state.jellyfinHostPort }).jellyfin;
  const [on, setOn] = useState(directPlay.publicUrl !== null);
  const [draft, setDraft] = useState(directPlay.publicUrl ?? suggested ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const home = directPlay.enabled && directPlay.privateUrl ? directPlay.privateUrl : null;
  const invalid = draft.trim() !== "" && !isValidLocalUrl(draft);
  const missing = directPlayIssues({ enabled: true, privateUrl: directPlay.privateUrl ?? "", publicEnabled: on, publicUrl: draft }).includes("public_missing");

  const persist = async (publicUrl: string | null) => {
    setStatus("saving");
    try {
      // La lecture directe s'allume avec l'adresse publique ; coupée, seule l'adresse publique s'efface.
      await remoteAccessApi.saveDirectPlay({ enabled: publicUrl !== null || directPlay.enabled, publicUrl });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REMOTE_ACCESS_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.directStreaming }),
      ]);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-content-tertiary">{home ? t("directHome", { url: home }) : t("directHomeOff")}</p>
      <div className="flex items-start justify-between gap-4 rounded-xl bg-fill-subtle p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content-primary">{t("directSwitch")}</p>
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{on ? t("directOn") : t("directOff")}</p>
        </div>
        <ToggleSwitch
          checked={on}
          disabled={!directPlay.privateUrl || status === "saving"}
          onChange={(next) => {
            setOn(next);
            setStatus("idle");
            if (!next && directPlay.publicUrl !== null) void persist(null);
          }}
          label={t("directSwitch")}
        />
      </div>
      {on ? (
        <div className="space-y-3">
          <Field
            label={t("directUrl")}
            hint={t("directUrlHint", { example: suggested ?? "https://jellyfin.example.com" })}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setStatus("idle");
            }}
            error={invalid ? t("lanAddressInvalid") : missing ? t("directUrlMissing") : null}
            placeholder={suggested ?? "https://jellyfin.example.com"}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
          />
          <button
            type="button"
            onClick={() => void persist(draft.trim().replace(/\/+$/, ""))}
            disabled={invalid || missing || status === "saving" || draft.trim().replace(/\/+$/, "") === directPlay.publicUrl}
            className={cls.bs}
          >
            {status === "saving" ? t("saving") : t("save")}
          </button>
        </div>
      ) : null}
      <p className="text-sm" aria-live="polite">
        {status === "saved" ? <span className="text-status-success-fg">{t("directSaved")}</span> : status === "failed" ? <span className="text-status-error-fg">{t("saveFailed")}</span> : null}
      </p>
    </div>
  );
}
