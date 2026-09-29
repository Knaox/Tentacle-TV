import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useTrailerReadiness } from "@tentacle-tv/api-client";
import { describeTrailerReadiness } from "@tentacle-tv/shared";
import { AdminNotice } from "../admin/kit";

/**
 * « Sur ce serveur » : le diagnostic, en tête du guide — la première chose que
 * cherche qui arrive depuis une fiche sans bande-annonce. Mal réglé : les
 * causes, dans l'ordre où les traiter. Bien réglé : un titre sans
 * bande-annonce n'en a simplement pas. Diagnostic inconnu ou serveur trop
 * ancien : rien — le guide se tait plutôt que de deviner.
 *
 * L'heure de la mesure n'est dite qu'à l'administrateur : c'est lui qui vient
 * voir si son réglage a pris (le serveur garde le diagnostic dix minutes).
 */
export const GuideStatus = memo(function GuideStatus({ isAdmin }: { isAdmin: boolean }) {
  const { t, i18n } = useTranslation("trailerHelp");
  const { data } = useTrailerReadiness();
  const summary = describeTrailerReadiness(data);
  if (!summary) return null;

  const checkedAt = data?.checkedAt ? new Date(data.checkedAt) : null;
  const time = checkedAt && !Number.isNaN(checkedAt.getTime())
    ? checkedAt.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <AdminNotice tone={summary.state === "ready" ? "success" : "warning"} title={t("statusTitle")} className="mt-8">
      <p>{t(summary.messageKey)}</p>
      {summary.reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          {summary.reasons.map((reason) => (
            <li key={reason.reason}>{t(reason.key, reason.values)}</li>
          ))}
        </ul>
      )}
      {isAdmin && time && <p className="mt-1.5 text-xs text-content-tertiary">{t("statusCheckedAt", { time })}</p>}
    </AdminNotice>
  );
});
