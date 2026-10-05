/**
 * Le guide de l'accès à distance : sa STRUCTURE (sections, paragraphes, liens
 * officiels), ses MOTS dans l'espace i18n `remoteAccessHelp`. Rendu à la fin
 * de la section d'administration « Accès à distance » (ancre `#guide`), et
 * lié depuis l'étape facultative de l'assistant d'installation.
 *
 * Les liens sont ceux des documentations officielles, ouverts le 2026-10-06.
 * Tailscale n'y est qu'un plan B documenté : Tentacle ne l'intègre pas.
 */

/** L'adresse de la section d'administration, et l'ancre du guide. */
export const REMOTE_ACCESS_ADMIN_PATH = "/admin/remote-access";
export const REMOTE_ACCESS_GUIDE_ANCHOR = "guide";

export const REMOTE_ACCESS_DOCS = {
  jellyfinNetworking: "https://jellyfin.org/docs/general/post-install/networking/",
  jellyfinReverseProxy: "https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/",
  jellyfinTailscale: "https://jellyfin.org/docs/general/post-install/networking/tailscale/",
  caddyReverseProxy: "https://caddyserver.com/docs/caddyfile/directives/reverse_proxy",
  caddyHttps: "https://caddyserver.com/docs/automatic-https",
  traefikFile: "https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/",
  traefikAcme: "https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/",
  cloudflareTerms: "https://www.cloudflare.com/service-specific-terms-application-services/#content-delivery-network-free-pro-or-business",
  cloudflareTunnel:
    "https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/#large-file-and-streaming-traffic-through-tunnel",
  tailscaleDownload: "https://tailscale.com/download",
  tailscaleQuickstart: "https://tailscale.com/docs/how-to/quickstart",
  tailscaleNat: "https://tailscale.com/blog/how-nat-traversal-works",
} as const;

export type RemoteAccessDoc = keyof typeof REMOTE_ACCESS_DOCS;

export type RemoteAccessGuideSectionId = "choose" | "ports" | "proxy" | "cloudflare" | "planB" | "practices";

export interface RemoteAccessGuideSection {
  id: RemoteAccessGuideSectionId;
  titleKey: string;
  paragraphKeys: readonly string[];
  /** Les liens de la section ; leur libellé est la clé `link_<doc>`. */
  links: readonly RemoteAccessDoc[];
}

export const REMOTE_ACCESS_GUIDE: readonly RemoteAccessGuideSection[] = [
  { id: "choose", titleKey: "choose_title", paragraphKeys: ["choose_p1", "choose_p2", "choose_p3", "choose_p4"], links: [] },
  {
    id: "ports",
    titleKey: "ports_title",
    paragraphKeys: ["ports_p1", "ports_p2", "ports_p3", "ports_p4"],
    links: ["jellyfinNetworking"],
  },
  {
    id: "proxy",
    titleKey: "proxy_title",
    paragraphKeys: ["proxy_p1", "proxy_p2", "proxy_p3"],
    links: ["caddyHttps", "caddyReverseProxy", "traefikFile", "traefikAcme", "jellyfinReverseProxy"],
  },
  {
    id: "cloudflare",
    titleKey: "cloudflare_title",
    paragraphKeys: ["cloudflare_p1", "cloudflare_p2", "cloudflare_p3"],
    links: ["cloudflareTerms", "cloudflareTunnel"],
  },
  {
    id: "planB",
    titleKey: "planB_title",
    paragraphKeys: ["planB_p1", "planB_p2"],
    links: ["tailscaleDownload", "tailscaleQuickstart", "tailscaleNat", "jellyfinTailscale"],
  },
  { id: "practices", titleKey: "practices_title", paragraphKeys: ["practices_p1", "practices_p2", "practices_p3"], links: [] },
];

/** La clé i18n du libellé d'un lien. */
export function remoteAccessDocLabelKey(doc: RemoteAccessDoc): string {
  return `link_${doc}`;
}
