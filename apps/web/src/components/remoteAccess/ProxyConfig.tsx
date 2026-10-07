import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  basePathOf,
  caddySnippet,
  isValidBasePath,
  isValidDomain,
  nginxSnippet,
  traefikSnippet,
  type ProxySnippetInput,
  type RemoteAccessState,
  type ReverseProxyKind,
} from "@tentacle-tv/shared";
import { TabPanel, Tabs } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { servicesApi } from "../admin/services/servicesApi";
import { SERVICES_KEYS } from "../admin/services/servicesModel";
import { cls } from "../../pages/adminUtils";
import { CopyBlock } from "./CopyBlock";
import { homeTentacleUrl, hostPortOf, parseHostPort } from "./lanAddress";
import { JellyfinModeChoice, type JellyfinMode } from "./JellyfinModeChoice";
import { REMOTE_ACCESS_KEY } from "./remoteAccessApi";

type SnippetTab = "caddy" | "nginx" | "traefik";

/** L'onglet ouvert d'abord : celui du mandataire choisi (Nginx pour « un autre »). */
function defaultTab(proxy: ReverseProxyKind): SnippetTab {
  return proxy === "caddy" || proxy === "traefik" ? proxy : "nginx";
}

/** Le nom d'hôte d'une adresse déjà réglée, s'il en fait un domaine. */
function domainOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    return isValidDomain(host) ? host : "";
  } catch {
    return "";
  }
}

/** Jellyfin tel qu'il est publié aujourd'hui : son domaine, un chemin du domaine de Tentacle, ou rien. */
function initialJellyfinMode(jellyfinPublic: string | null, tentacleDomain: string): JellyfinMode {
  const domain = domainOf(jellyfinPublic);
  if (!domain) return "none";
  return domain === tentacleDomain && basePathOf(jellyfinPublic) ? "path" : "domain";
}

/**
 * L'exemple de configuration pour le mandataire de l'utilisateur — les piles
 * livrées n'en embarquent aucun. Tout est prérempli d'après ce qui est réglé
 * (lien public, adresses de Jellyfin) et reste modifiable : l'adresse de
 * Tentacle et celle de Jellyfin vues par le mandataire (hôte ET port — dans
 * l'application de bureau, l'adresse vient du serveur, pas de la page), et
 * Jellyfin sur son domaine ou sous un chemin du domaine de Tentacle
 * (`/jellyfin` : même origine, aucun en-tête CORS).
 */
export function ProxyConfig({ state }: { state: RemoteAccessState }) {
  const { t } = useTranslation("remoteAccess");
  const tabsId = useId();
  const queryClient = useQueryClient();
  const proxy = state.settings.proxy;
  const jellyfinPublic = state.directPlay?.publicUrl ?? state.jellyfinPublicUrl;
  const [tentacleDomain, setTentacleDomain] = useState(() => domainOf(state.publicUrl));
  const [mode, setMode] = useState<JellyfinMode>(() => initialJellyfinMode(jellyfinPublic, domainOf(state.publicUrl)));
  const [jellyfinDomain, setJellyfinDomain] = useState(() => (mode === "domain" ? domainOf(jellyfinPublic) : ""));
  const [jellyfinPath, setJellyfinPath] = useState(() => basePathOf(jellyfinPublic) ?? "/jellyfin");
  const [tentacleUpstream, setTentacleUpstream] = useState(() => hostPortOf(homeTentacleUrl(state)) ?? "");
  const [jellyfinUpstream, setJellyfinUpstream] = useState(() => hostPortOf(state.directPlay?.privateUrl ?? null) ?? "");
  // L'onglet choisi à la main vaut pour CE mandataire ; en changer rouvre le sien.
  const [picked, setPicked] = useState<{ proxy: ReverseProxyKind; tab: SnippetTab } | null>(null);
  const tab = picked && picked.proxy === proxy ? picked.tab : defaultTab(proxy);
  const [publicUrlState, setPublicUrlState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const exampleTentacle = `192.168.1.20:${state.hostPort}`;
  const exampleJellyfin = `${parseHostPort(tentacleUpstream)?.host ?? "192.168.1.20"}:${state.jellyfinHostPort ?? 8096}`;
  const tentacleTarget = parseHostPort(tentacleUpstream || exampleTentacle);
  const jellyfinTarget = parseHostPort(jellyfinUpstream || exampleJellyfin);
  const domain = tentacleDomain.trim().toLowerCase();
  const errors = {
    tentacleDomain: tentacleDomain && !isValidDomain(domain) ? t("domainInvalid") : null,
    jellyfinDomain: mode === "domain" && jellyfinDomain && !isValidDomain(jellyfinDomain) ? t("domainInvalid") : null,
    jellyfinPath: mode === "path" && !isValidBasePath(jellyfinPath.trim()) ? t("pathInvalid") : null,
    tentacleUpstream: tentacleTarget ? null : t("upstreamInvalid"),
    jellyfinUpstream: mode !== "none" && !jellyfinTarget ? t("upstreamInvalid") : null,
  };
  const ready = isValidDomain(domain) && !Object.values(errors).some(Boolean) && (mode !== "domain" || isValidDomain(jellyfinDomain));

  const input: ProxySnippetInput | null =
    ready && tentacleTarget
      ? {
          tentacleDomain: domain,
          jellyfinDomain: mode === "domain" ? jellyfinDomain.trim().toLowerCase() : null,
          jellyfinPath: mode === "path" ? jellyfinPath.trim() : null,
          upstreamHost: tentacleTarget.host,
          tentaclePort: tentacleTarget.port,
          jellyfinUpstreamHost: jellyfinTarget?.host ?? null,
          jellyfinPort: jellyfinTarget?.port ?? 8096,
        }
      : null;

  const wantedUrl = isValidDomain(domain) ? `https://${domain}` : null;
  const savePublicUrl = async () => {
    if (!wantedUrl) return;
    setPublicUrlState("saving");
    try {
      await servicesApi.savePublicUrl(wantedUrl);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REMOTE_ACCESS_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.publicUrl }),
      ]);
      setPublicUrlState("saved");
    } catch {
      setPublicUrlState("failed");
    }
  };
  const text = { autoComplete: "off", spellCheck: false } as const;

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Field {...text} inputMode="url" label={t("domainTentacle")} hint={t("domainTentacleHint")} value={tentacleDomain} onChange={(e) => setTentacleDomain(e.target.value)} error={errors.tentacleDomain} placeholder="tentacle.example.com" />
        <Field {...text} label={t("tentacleUpstream")} hint={t("tentacleUpstreamHint", { port: state.hostPort })} value={tentacleUpstream} onChange={(e) => setTentacleUpstream(e.target.value)} error={tentacleUpstream ? errors.tentacleUpstream : null} placeholder={exampleTentacle} />
      </div>
      <JellyfinModeChoice value={mode} onChange={setMode} />
      {mode !== "none" ? (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {mode === "domain" ? (
            <Field {...text} inputMode="url" label={t("domainJellyfin")} hint={t("domainJellyfinHint")} value={jellyfinDomain} onChange={(e) => setJellyfinDomain(e.target.value)} error={errors.jellyfinDomain} placeholder="jellyfin.example.com" />
          ) : (
            <Field {...text} label={t("jellyfinPath")} hint={`${t("jellyfinPathHint")} ${t("pathSameOrigin")}`} value={jellyfinPath} onChange={(e) => setJellyfinPath(e.target.value)} error={errors.jellyfinPath} placeholder="/jellyfin" />
          )}
          <Field {...text} label={t("jellyfinUpstream")} hint={t("jellyfinUpstreamHint")} value={jellyfinUpstream} onChange={(e) => setJellyfinUpstream(e.target.value)} error={jellyfinUpstream ? errors.jellyfinUpstream : null} placeholder={exampleJellyfin} />
        </div>
      ) : null}

      {input ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-content-tertiary">{t("snippetIntro")}</p>
          <Tabs
            idPrefix={tabsId}
            label={t("proxyTitle")}
            active={tab}
            onChange={(next) => setPicked({ proxy, tab: next })}
            items={[
              { id: "nginx", label: t("snippetNginx") },
              { id: "caddy", label: t("snippetCaddy") },
              { id: "traefik", label: t("snippetTraefik") },
            ]}
          />
          <TabPanel idPrefix={tabsId} id="nginx" active={tab === "nginx"} className="space-y-2">
            <p className="text-sm leading-relaxed text-content-tertiary">
              {input.jellyfinPath
                ? t("npmHintPath", { domain: input.tentacleDomain, target: `http://${input.upstreamHost}:${input.tentaclePort}`, path: input.jellyfinPath, jellyfin: `http://${input.jellyfinUpstreamHost}:${input.jellyfinPort}` })
                : t("npmHint", { target: `http://${input.upstreamHost}:${input.tentaclePort}` })}
            </p>
            <CopyBlock label={t("snippetNginx")} code={nginxSnippet(input)} />
            <p className="text-xs text-content-quaternary">{t("nginxCertHint")}</p>
          </TabPanel>
          <TabPanel idPrefix={tabsId} id="caddy" active={tab === "caddy"} className="space-y-2">
            <p className="text-sm leading-relaxed text-content-tertiary">{t("caddyHint")}</p>
            <CopyBlock label={t("snippetCaddy")} code={caddySnippet(input)} />
          </TabPanel>
          <TabPanel idPrefix={tabsId} id="traefik" active={tab === "traefik"} className="space-y-2">
            <p className="text-sm leading-relaxed text-content-tertiary">{t("traefikHint")}</p>
            <CopyBlock label={t("snippetTraefik")} code={traefikSnippet(input)} />
          </TabPanel>
        </div>
      ) : null}

      {wantedUrl && wantedUrl !== state.publicUrl ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
          <p className="mr-auto min-w-0 text-sm text-content-tertiary" aria-live="polite">
            {publicUrlState === "saved" ? t("publicUrlSaved") : publicUrlState === "failed" ? t("saveFailed") : state.publicUrl ? t("publicUrlCurrent", { url: state.publicUrl }) : t("publicUrlNone")}
          </p>
          <button type="button" onClick={() => void savePublicUrl()} disabled={publicUrlState === "saving"} className={cls.bbrand}>
            {publicUrlState === "saving" ? t("saving") : t("usePublicUrl", { domain })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
