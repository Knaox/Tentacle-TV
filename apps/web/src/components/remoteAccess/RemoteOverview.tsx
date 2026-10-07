import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Globe, House } from "lucide-react";
import type { JellyfinCorsReport, RemoteAccessState } from "@tentacle-tv/shared";
import { AdminSection, StatusPill, type StatusTone } from "../admin/kit";
import { readableOrigins } from "./corsOrigins";
import { homeTentacleUrl } from "./lanAddress";

const CORS_TONE: Record<JellyfinCorsReport["status"], StatusTone> = {
  open: "success",
  ready: "success",
  updated: "success",
  unreachable: "warning",
  not_configured: "neutral",
};

/**
 * L'état, en lecture seule : ce que reçoivent les applications à la maison
 * et hors de la maison, pour Tentacle et pour les vidéos — puis le HTTPS, les
 * CorsHosts de Jellyfin et l'adresse publique de la box. Rien ne s'y règle :
 * les adresses sont dans le formulaire juste dessous.
 */
export const RemoteOverview = memo(function RemoteOverview({ state, publicIp }: { state: RemoteAccessState; publicIp: string | null }) {
  const { t } = useTranslation("remoteAccess");
  const direct = state.directPlay;
  const directOn = !!direct?.enabled && !!direct.privateUrl;
  const home = homeTentacleUrl(state);
  const https = state.publicUrl?.startsWith("https://") ?? false;
  const cors = state.jellyfinCors;
  const corsList = cors && cors.status !== "open" ? readableOrigins(cors.origins, t("corsDesktop")) : [];

  return (
    <AdminSection id="overview" title={t("overviewTitle")} description={t("overviewDescription")}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Place icon={<House size={16} aria-hidden="true" />} title={t("overviewHome")}>
            <Row label={t("overviewTentacle")} value={home} fallback={t("overviewHomeTentacle")} />
            <Row
              label={t("overviewJellyfin")}
              value={directOn ? direct!.privateUrl : null}
              detail={directOn ? t("overviewDirect") : null}
              fallback={direct?.enabled === false ? t("overviewDirectOff") : t("overviewViaTentacle")}
            />
          </Place>
          <Place icon={<Globe size={16} aria-hidden="true" />} title={t("overviewAway")}>
            {state.publicUrl ? (
              <>
                <Row label={t("overviewTentacle")} value={state.publicUrl} />
                <Row
                  label={t("overviewJellyfin")}
                  value={directOn && direct!.publicUrl ? direct!.publicUrl : null}
                  detail={directOn && direct!.publicUrl ? t("overviewDirect") : null}
                  fallback={t("overviewViaTentacle")}
                />
              </>
            ) : (
              <p className="text-sm leading-relaxed text-content-secondary">{t("overviewNoPublic")}</p>
            )}
          </Place>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label={t("overviewTitle")}>
          {state.publicUrl ? (
            <li>
              <StatusPill tone={https ? "success" : "warning"} size="sm">{https ? t("overviewHttps") : t("overviewHttp")}</StatusPill>
            </li>
          ) : null}
          {cors ? (
            <li>
              <StatusPill tone={CORS_TONE[cors.status]} size="sm">{t(`cors_${cors.status}`)}</StatusPill>
            </li>
          ) : null}
          {publicIp ? (
            <li>
              <StatusPill tone="neutral" size="sm">
                <span className="tabular-nums">{t("overviewPublicIp", { ip: publicIp })}</span>
              </StatusPill>
            </li>
          ) : null}
        </ul>
        {cors?.status === "open" ? (
          <p className="text-xs leading-relaxed text-content-tertiary">{t("corsOpenBody")}</p>
        ) : corsList.length ? (
          <p className="break-words text-xs leading-relaxed text-content-tertiary">{t("corsOrigins", { list: corsList.join(", ") })}</p>
        ) : null}
      </div>
    </AdminSection>
  );
});

function Place({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line-subtle bg-fill-faint p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-content-primary">
        <span className="text-content-tertiary">{icon}</span>
        {title}
      </p>
      <dl className="mt-3 space-y-3">{children}</dl>
    </div>
  );
}

function Row({ label, value, detail, fallback }: { label: string; value: string | null; detail?: string | null; fallback?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-tertiary">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value ? <span className="break-all font-mono text-content-primary">{value}</span> : <span className="text-content-secondary">{fallback}</span>}
        {detail ? <span className="mt-0.5 block text-xs text-content-tertiary">{detail}</span> : null}
      </dd>
    </div>
  );
}
