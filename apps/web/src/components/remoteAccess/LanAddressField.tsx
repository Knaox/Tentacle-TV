import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RemoteAccessSettingsPatch, RemoteAccessState } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { Field } from "../admin/services/Field";
import { guessLanUrl, isValidLocalUrl } from "./lanAddress";

/**
 * « Adresse de ce serveur sur votre réseau » : pré-remplie d'après l'adresse
 * par laquelle on a ouvert cette page (l'IP locale, s'il en est une),
 * expliquée par un exemple, modifiable. Elle vaut pour les appareils de la
 * maison et pour la box (la cible des redirections) — privée ou public.
 */
export function LanAddressField({ state, save }: { state: RemoteAccessState; save: (patch: RemoteAccessSettingsPatch) => Promise<unknown> }) {
  const { t } = useTranslation("remoteAccess");
  const guessed = useMemo(() => guessLanUrl(), []);
  const [draft, setDraft] = useState(state.settings.localUrl ?? guessed ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const clean = draft.trim().replace(/\/+$/, "");
  const dirty = clean !== (state.settings.localUrl ?? "");
  const invalid = draft.trim() !== "" && !isValidLocalUrl(draft);
  const example = guessed ?? `http://192.168.1.20:${state.hostPort}`;

  const submit = async () => {
    setStatus("saving");
    try {
      await save({ localUrl: clean === "" ? null : clean });
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="space-y-3">
      <Field
        label={t("lanAddress")}
        hint={`${!state.settings.localUrl && guessed && draft === guessed ? `${t("lanAddressDetected")} ` : ""}${t("lanExample", { example })}`}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus("idle");
        }}
        error={invalid ? t("lanAddressInvalid") : null}
        placeholder={example}
        autoComplete="off"
        spellCheck={false}
        inputMode="url"
      />
      <button type="button" onClick={() => void submit()} disabled={!dirty || invalid || status === "saving"} className={cls.bs}>
        {status === "saving" ? t("saving") : status === "saved" && !dirty ? t("saved") : t("save")}
      </button>
      {status === "failed" ? (
        <p role="alert" className="text-sm text-status-error-fg">
          {t("saveFailed")}
        </p>
      ) : null}
      <div className="space-y-1 text-sm leading-relaxed text-content-tertiary">
        <p>{t("lanUsedFor")}</p>
        <p>{t("lanAddressHint")}</p>
      </div>
    </div>
  );
}
