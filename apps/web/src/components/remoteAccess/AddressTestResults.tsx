import { useTranslation } from "react-i18next";
import { StatusPill } from "../admin/kit";
import type { DirectStreamingTest, UrlProbe } from "../admin/services/servicesModel";
import { readableOrigins } from "./corsOrigins";

/**
 * Ce que le serveur voit des adresses de Jellyfin, ligne par ligne : répond-il,
 * en quelle version, et accepte-t-il l'origine de cette page (CORS) — les
 * CorsHosts ont été complétés JUSTE AVANT par le serveur, ce qui a été ajouté
 * est dit. Une adresse du même domaine que la page n'a besoin d'aucun CORS.
 * L'adresse PUBLIQUE injoignable depuis le serveur n'est pas une panne : la
 * plupart des box ne bouclent pas vers leur propre adresse publique.
 */
export function AddressTestResults({ result }: { result: DirectStreamingTest }) {
  const { t } = useTranslation("remoteAccess");
  const rows: Array<{ key: "public" | "private"; label: string; probe: UrlProbe }> = [];
  if (result.private) rows.push({ key: "private", label: t("testPrivate"), probe: result.private });
  if (result.public) rows.push({ key: "public", label: t("testPublic"), probe: result.public });
  if (rows.length === 0) return null;

  const refused = rows.some(({ probe }) => probe.ok && probe.corsOk === false && !probe.sameOrigin);
  const publicDown = result.public && !result.public.ok ? result.public : null;
  const added = result.cors?.added.length ? readableOrigins(result.cors.added, t("corsDesktop")) : [];

  return (
    <div className="space-y-2" role="status">
      <ul className="divide-y divide-line-subtle rounded-lg border border-line-subtle">
        {rows.map(({ key, label, probe }) => (
          <li key={key} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="mr-auto text-sm font-medium text-content-primary">{label}</span>
            {probe.ok ? (
              <>
                <StatusPill tone="success" size="sm">{t("testOk", { version: probe.version ?? "?" })}</StatusPill>
                {probe.sameOrigin ? (
                  <StatusPill tone="success" size="sm">{t("testSameOrigin")}</StatusPill>
                ) : probe.corsOk !== null ? (
                  <StatusPill tone={probe.corsOk ? "success" : "warning"} size="sm">
                    {probe.corsOk ? t("testCorsOk") : t("testCorsRefused")}
                  </StatusPill>
                ) : null}
              </>
            ) : (
              <StatusPill tone={key === "public" ? "neutral" : "error"} size="sm" title={probe.error ?? undefined} className="max-w-full truncate">
                {t("testUnreachable", { error: probe.error ?? "?" })}
              </StatusPill>
            )}
          </li>
        ))}
      </ul>
      {added.length ? <p className="text-xs leading-relaxed text-status-success-fg">{t("testCorsAdded", { list: added.join(", ") })}</p> : null}
      {publicDown ? <p className="text-xs leading-relaxed text-content-tertiary">{t("testPublicUnreachable", { error: publicDown.error ?? "?" })}</p> : null}
      {refused ? <p className="text-xs leading-relaxed text-status-warning-fg">{t("testCorsRefusedBody")}</p> : null}
    </div>
  );
}
