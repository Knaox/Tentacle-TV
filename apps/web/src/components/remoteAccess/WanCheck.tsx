import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cgnatFromRouterWan } from "@tentacle-tv/shared";
import { Field } from "../admin/services/Field";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/**
 * Le partage d'adresse (CGNAT) se voit en comparant l'adresse WAN de la box à
 * celle que le service voit d'Internet. La saisie reste dans la page : rien
 * n'est enregistré.
 */
export const WanCheck = memo(function WanCheck({ value, onChange, publicIpV4 }: { value: string; onChange: (v: string) => void; publicIpV4: string | null }) {
  const { t } = useTranslation("remoteAccess");
  const wan = value.trim();
  const invalid = wan !== "" && !IPV4.test(wan);
  const verdict = !invalid && wan ? cgnatFromRouterWan(publicIpV4, wan) : null;
  const message =
    verdict === "none" ? t("wan_none") : verdict ? t(`wan_${verdict}`) : wan && !invalid && !publicIpV4 ? t("wanNeedsTest") : null;
  const tone = verdict === "none" ? "text-status-success-fg" : verdict ? "text-status-warning-fg" : "text-content-tertiary";

  return (
    <div className="rounded-xl border border-line-subtle bg-fill-faint p-4">
      <h3 className="text-sm font-semibold text-content-primary">{t("wanTitle")}</h3>
      <Field
        label={t("wanLabel")}
        hint={t("wanHint")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={invalid ? t("wanInvalid") : null}
        placeholder="203.0.113.5"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        className="mt-3 max-w-xs"
      />
      {message ? (
        <p className={`mt-2 text-sm ${tone}`} aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
});
