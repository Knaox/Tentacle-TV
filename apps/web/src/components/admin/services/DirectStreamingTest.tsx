import { useTranslation } from "react-i18next";
import { StatusPill } from "../kit";
import type { DirectStreamingTest, UrlProbe } from "./servicesModel";

/**
 * Ce que l'essai des adresses de lecture directe a trouvé, adresse par
 * adresse : Jellyfin répond-il, en quelle version, et autorise-t-il l'origine
 * de Tentacle (CORS) — sans quoi la lecture directe échoue dans un navigateur.
 */
export function DirectStreamingTestResults({ result }: { result: DirectStreamingTest }) {
  const { t } = useTranslation("adminServices");
  const rows: Array<[string, UrlProbe]> = [];
  if (result.public) rows.push([t("directTestPublic"), result.public]);
  if (result.private) rows.push([t("directTestPrivate"), result.private]);

  if (rows.length === 0) return <p className="text-xs text-content-tertiary">{t("directTestNone")}</p>;
  const corsMissing = rows.some(([, probe]) => probe.ok && probe.corsOk === false);
  return (
    <div className="space-y-2" role="status">
      <ul className="divide-y divide-line-subtle rounded-lg border border-line-subtle">
        {rows.map(([label, probe]) => (
          <li key={label} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="mr-auto text-sm font-medium text-content-primary">{label}</span>
            {probe.ok ? (
              <>
                <StatusPill tone="success" size="sm">{t("directTestOk", { version: probe.version ?? "?" })}</StatusPill>
                {probe.corsOk !== null && (
                  <StatusPill tone={probe.corsOk ? "success" : "warning"} size="sm">
                    {probe.corsOk ? t("directCorsOk") : t("directCorsMissing")}
                  </StatusPill>
                )}
              </>
            ) : (
              <StatusPill tone="error" size="sm" title={probe.error ?? undefined} className="max-w-full truncate">{probe.error ?? t("errorUnreachable")}</StatusPill>
            )}
          </li>
        ))}
      </ul>
      {corsMissing && <p className="text-xs leading-relaxed text-status-warning-fg">{t("directCorsWarning")}</p>}
    </div>
  );
}
