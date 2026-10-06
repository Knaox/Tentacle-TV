import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  caddySnippet,
  isValidDomain,
  lanAddressOf,
  nginxSnippet,
  traefikSnippet,
  type RemoteAccessState,
  type ReverseProxyKind,
} from "@tentacle-tv/shared";
import { AdminNotice, TabPanel, Tabs } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { servicesApi } from "../admin/services/servicesApi";
import { SERVICES_KEYS } from "../admin/services/servicesModel";
import { cls } from "../../pages/adminUtils";
import { CopyBlock } from "./CopyBlock";
import { REMOTE_ACCESS_KEY } from "./remoteAccessApi";

type SnippetTab = "caddy" | "nginx" | "traefik";

/** L'onglet ouvert d'abord : celui du mandataire choisi (Nginx pour « un autre »). */
function defaultTab(proxy: ReverseProxyKind): SnippetTab {
  return proxy === "caddy" || proxy === "traefik" ? proxy : "nginx";
}

/** Le nom d'hôte d'une adresse déjà réglée, s'il en fait un domaine. */
function domainOf(url: string | null): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    return isValidDomain(host) ? host : "";
  } catch {
    return "";
  }
}

/**
 * La configuration du mandataire de l'utilisateur — les piles livrées n'en
 * embarquent aucun : les domaines, l'adresse de ce serveur vue par le
 * mandataire, puis l'extrait à y poser (Caddyfile, Nginx / Nginx Proxy
 * Manager, Traefik ; l'onglet du mandataire choisi s'ouvre d'abord) et le lien
 * public à régler.
 */
export function ProxyConfig({ state }: { state: RemoteAccessState }) {
  const { t } = useTranslation("remoteAccess");
  const tabsId = useId();
  const queryClient = useQueryClient();
  const proxy = state.settings.proxy;
  const [tentacleDomain, setTentacleDomain] = useState(() => domainOf(state.publicUrl));
  const [jellyfinDomain, setJellyfinDomain] = useState(() => domainOf(state.jellyfinPublicUrl));
  const [upstream, setUpstream] = useState(() => lanAddressOf(state.settings.localUrl) ?? "");
  // L'onglet choisi à la main vaut pour CE mandataire ; en changer rouvre le sien.
  const [picked, setPicked] = useState<{ proxy: ReverseProxyKind; tab: SnippetTab } | null>(null);
  const tab = picked && picked.proxy === proxy ? picked.tab : defaultTab(proxy);
  const [publicUrlState, setPublicUrlState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const tentacleOk = isValidDomain(tentacleDomain);
  const jellyfinOk = jellyfinDomain === "" || isValidDomain(jellyfinDomain);
  const domainsOk = tentacleOk && jellyfinOk;
  const input = useMemo(
    () => ({
      tentacleDomain: tentacleDomain.trim().toLowerCase(),
      jellyfinDomain: jellyfinDomain.trim() ? jellyfinDomain.trim().toLowerCase() : null,
      upstreamHost: upstream.trim() || "192.168.1.20",
      tentaclePort: state.hostPort,
      jellyfinPort: state.jellyfinHostPort ?? 8096,
    }),
    [tentacleDomain, jellyfinDomain, upstream, state.hostPort, state.jellyfinHostPort],
  );

  if (proxy === "none") return <AdminNotice tone="error">{t("noneWarning")}</AdminNotice>;

  const wantedUrl = tentacleOk ? `https://${input.tentacleDomain}` : null;

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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("domainTentacle")}
          hint={t("domainTentacleHint")}
          value={tentacleDomain}
          onChange={(e) => setTentacleDomain(e.target.value)}
          error={tentacleDomain && !tentacleOk ? t("domainInvalid") : null}
          placeholder="tentacle.example.com"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
        />
        <Field
          label={t("domainJellyfin")}
          hint={t("domainJellyfinHint")}
          value={jellyfinDomain}
          onChange={(e) => setJellyfinDomain(e.target.value)}
          error={!jellyfinOk ? t("domainInvalid") : null}
          placeholder="jellyfin.example.com"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
        />
      </div>

      {domainsOk ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-content-tertiary">{t("snippetIntro")}</p>
          <Field
            label={t("upstreamHost")}
            hint={t("upstreamHostHint")}
            value={upstream}
            onChange={(e) => setUpstream(e.target.value)}
            placeholder="192.168.1.20"
            autoComplete="off"
            spellCheck={false}
            className="max-w-sm"
          />
          <Tabs
            idPrefix={tabsId}
            label={t("step1Title")}
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
              {t("npmHint", { target: `http://${input.upstreamHost}:${input.tentaclePort}` })}
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

      <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
        <p className="mr-auto min-w-0 text-sm text-content-tertiary" aria-live="polite">
          {publicUrlState === "saved"
            ? t("publicUrlSaved")
            : publicUrlState === "failed"
              ? t("saveFailed")
              : state.publicUrl
                ? t("publicUrlCurrent", { url: state.publicUrl })
                : t("publicUrlNone")}
        </p>
        {wantedUrl && wantedUrl !== state.publicUrl ? (
          <button type="button" onClick={() => void savePublicUrl()} disabled={publicUrlState === "saving"} className={cls.bbrand}>
            {publicUrlState === "saving" ? t("saving") : t("usePublicUrl", { domain: input.tentacleDomain })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
