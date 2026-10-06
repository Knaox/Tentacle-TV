import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { cls } from "../../pages/adminUtils";
import { Field } from "../admin/services/Field";
import { hostAndPort, isValidClientUrl } from "./jellyfinChoice";
import type { Wizard } from "./useWizard";
import { pathOf, selectionOf } from "./wizardModel";
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
  const selection = selectionOf(data.context);
  const jellyfin = selection
    ? t("recapJellyfinLine", {
        name: selection.serverName || t("jfUnnamed"),
        version: selection.version,
        ...hostAndPort(selection.url),
        state: t(selection.path === "fresh" ? "jfState_blank" : "jfState_configured"),
      })
    : "—";
  // Un Jellyfin déjà configuré : rien n'y est créé, seuls les réglages cochés changent.
  const joined = pathOf(data.context) === "configured";
  const kept = data.existing.map((library) => library.name).join(" · ");
  const advice = data.advice?.ids ?? [];
  const rows: Array<[string, string]> = joined
    ? [
        [t("recapJellyfin"), jellyfin],
        [t("recapAccount"), data.credentials?.username ?? "—"],
        [t("recapLibrariesKeptLabel"), kept ? t("recapLibrariesExisting", { names: kept }) : t("recapLibrariesNoneYet")],
        [t("recapAdvice"), advice.length ? advice.map((id) => t(`rec_${id}`)).join(" · ") : t("recapNothing")],
      ]
    : [
        [t("recapJellyfin"), jellyfin],
        [t("recapAccount"), data.credentials?.username ?? "—"],
        [t("recapLocale"), `${t(`lang_${data.locale.language}`)} · ${t(`country_${data.locale.country}`)}`],
        [t("recapLibraries"), data.plans.length ? data.plans.map((p) => `${p.name} (${p.paths[0]})`).join(" · ") : t("recapNothing")],
      ];
  return (
    <WizardFrame title={t("recapTitle")} subtitle={t("recapSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back} server={wizard.server}>
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
