import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { cls } from "../../pages/adminUtils";
import { Field } from "../admin/services/Field";
import { hostAndPort, isValidClientUrl, serverState } from "./jellyfinChoice";
import type { Wizard } from "./useWizard";
import { joinsConfigured } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

const primary = `${cls.bp} w-full sm:w-auto`;

/**
 * Tout ce qui va être fait, et l'adresse de Jellyfin que recevront les
 * applications (lecture directe) : proposée d'après l'adresse de cette page et
 * le port publié, modifiable ici — jamais un nom Docker.
 */
export function RecapScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const { data } = wizard;
  const [clientUrl, setClientUrl] = useState(data.clientUrl);
  const invalid = clientUrl.trim() !== "" && !isValidClientUrl(clientUrl);
  const jellyfin = data.probe
    ? t("recapJellyfinLine", { name: data.probe.serverName, version: data.probe.version, ...hostAndPort(data.probe.url), state: t(`jfState_${serverState(data.probe)}`) })
    : data.jellyfinUrl || data.context?.jellyfin.url || "—";
  // Un Jellyfin déjà configuré : rien n'y est créé, seuls les réglages cochés changent.
  const joined = joinsConfigured(data.context, data.mode);
  const advice = data.advice?.ids ?? [];
  const rows: Array<[string, string]> = joined
    ? [
        [t("recapJellyfin"), jellyfin],
        [t("recapAccount"), data.credentials?.username ?? "—"],
        [t("recapLibrariesKeptLabel"), t("recapLibrariesKept", { count: data.existing.length })],
        [t("recapAdvice"), advice.length ? advice.map((id) => t(`rec_${id}`)).join(" · ") : t("recapNothing")],
      ]
    : [
        [t("recapJellyfin"), jellyfin],
        [t("recapAccount"), data.credentials?.username ?? "—"],
        [t("recapLocale"), `${t(`lang_${data.locale.language}`)} · ${t(`country_${data.locale.country}`)}`],
        [t("recapLibraries"), data.plans.length ? data.plans.map((p) => `${p.name} (${p.paths[0]})`).join(" · ") : t("recapNothing")],
      ];
  return (
    <WizardFrame title={t("recapTitle")} subtitle={t("recapSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <dl className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-xs font-medium text-content-tertiary">{label}</dt>
            <dd className="break-words text-sm text-content-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          wizard.patch({ clientUrl: clientUrl.trim().replace(/\/+$/, "") });
          wizard.next();
        }}
        className="mt-6 space-y-6"
      >
        <Field
          label={t("recapClientUrl")}
          hint={t("recapClientUrlHint")}
          value={clientUrl}
          onChange={(e) => setClientUrl(e.target.value)}
          error={invalid ? t("recapClientUrlInvalid") : null}
          placeholder="http://192.168.1.20:8096"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={invalid} className={primary}>
          {t("recapApply")}
        </button>
      </form>
    </WizardFrame>
  );
}
