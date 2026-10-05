import type { CheckService } from "./checkProtocol";
import { isPrivateIpv4 } from "./portPlan";
import type { RemoteCheckItem, RemoteCheckReport } from "./remoteAccessContract";

/**
 * Le verdict du test d'ouverture — une seule règle, lue par l'assistant
 * d'installation ET par la section « Accès à distance » : par service, ce qui
 * marche, et la cause PROBABLE de ce qui ne marche pas, dite en mots simples
 * (espace i18n `remoteAccess`, `cause_<clé>`). Logique pure.
 *
 * - `secure` : joignable d'Internet en HTTPS valide — le but ;
 * - `exposed_http` : joignable d'Internet en HTTP clair — en rouge, même si
 *   HTTPS marche aussi : mots de passe et jetons passent en clair ;
 * - `attention` : il répond, mais quelque chose cloche (certificat, mandataire) ;
 * - `unreachable` : personne ne le joint de l'extérieur ;
 * - `not_checked` : pas de cible pour ce service, ou pas de test.
 */

export type RemoteServiceState = "secure" | "exposed_http" | "attention" | "unreachable" | "not_checked";
export type RemoteTone = "success" | "danger" | "warning" | "neutral";

export type RemoteCause =
  /** Rien ne répond : la redirection manque, ou un pare-feu jette. */
  | "port_not_forwarded"
  /** Refusé : la box redirige vers un autre appareil, ou rien n'écoute sur ce port. */
  | "wrong_target"
  /** Quelque chose répond, mais pas ce serveur. */
  | "other_service"
  /** Le mandataire répond, mais il ne joint pas Tentacle ou Jellyfin (502, 503, 504). */
  | "proxy_upstream"
  /** HTTPS refusé : auto-signé, expiré, mauvais nom, autorité inconnue. */
  | "certificate"
  /** Le domaine désigne une autre adresse que ce serveur (CDN, DNS à corriger). */
  | "dns_elsewhere"
  /** Le domaine ne se résout pas. */
  | "dns_missing"
  /** L'adresse de la box n'est pas celle vue d'Internet : adresse partagée par l'opérateur. */
  | "cgnat_suspected"
  /** La box reçoit une adresse privée : un autre routeur est devant elle. */
  | "double_nat"
  /** HTTPS passe, le port 80 non : pas de redirection vers HTTPS ni de certificat renouvelé par HTTP. */
  | "http_port_closed"
  /** IPv4 passe, IPv6 non : le pare-feu IPv6 de la box bloque l'entrant. */
  | "ipv6_firewall"
  /** Ce serveur n'a pas d'IPv6 vers Internet : rien à tester de ce côté. */
  | "ipv6_not_testable";

export interface RemoteServiceVerdict {
  service: CheckService;
  state: RemoteServiceState;
  tone: RemoteTone;
  causes: RemoteCause[];
  items: RemoteCheckItem[];
}

export interface RemoteVerdict {
  services: RemoteServiceVerdict[];
  /** `null` : rien pour en juger (adresse de la box non donnée). */
  cgnat: "cgnat_suspected" | "double_nat" | "none" | null;
}

const TONES: Record<RemoteServiceState, RemoteTone> = {
  secure: "success",
  exposed_http: "danger",
  attention: "warning",
  unreachable: "warning",
  not_checked: "neutral",
};

/** 100.64.0.0/10 : la plage réservée au partage d'adresse par l'opérateur (RFC 6598). */
function isSharedAddressSpace(ip: string): boolean {
  const m = ip.match(/^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  return !!m && Number(m[1]) >= 64 && Number(m[1]) <= 127;
}

/**
 * Comparer l'adresse WAN affichée par la box à l'adresse vue d'Internet :
 * différente, ou dans 100.64/10, c'est une adresse partagée (CGNAT) — aucune
 * redirection de la box n'y fera rien ; privée, un autre routeur est devant.
 */
export function cgnatFromRouterWan(publicIpV4: string | null, routerWanIp: string | null): RemoteVerdict["cgnat"] {
  const wan = routerWanIp?.trim();
  if (!wan) return null;
  if (isSharedAddressSpace(wan)) return "cgnat_suspected";
  if (isPrivateIpv4(wan)) return "double_nat";
  if (!publicIpV4) return null;
  return wan === publicIpV4 ? "none" : "cgnat_suspected";
}

function causeOf(item: RemoteCheckItem): RemoteCause | null {
  switch (item.verdict) {
    case "timeout":
      return "port_not_forwarded";
    case "refused":
    case "unreachable":
      return "wrong_target";
    case "wrong_service":
      return "other_service";
    case "http_error":
      return item.httpStatus !== null && item.httpStatus >= 502 && item.httpStatus <= 504 ? "proxy_upstream" : "other_service";
    case "tls_self_signed":
    case "tls_expired":
    case "tls_name_mismatch":
    case "tls_untrusted":
    case "tls_error":
      return "certificate";
    case "dns_mismatch":
      return "dns_elsewhere";
    case "dns_error":
      return "dns_missing";
    case "not_testable":
      return "ipv6_not_testable";
    default:
      return null;
  }
}

const isOk = (i: RemoteCheckItem): boolean => i.verdict === "open" || i.verdict === "redirect";

/** La cause d'un échec, lue avec ses voisines : la même cible en IPv4, HTTPS dans la même famille. */
function causeInContext(item: RemoteCheckItem, items: RemoteCheckItem[]): RemoteCause | null {
  const cause = causeOf(item);
  if (cause !== "port_not_forwarded") return cause;
  if (item.family === 6 && items.some((o) => o.family === 4 && o.scheme === item.scheme && o.port === item.port && isOk(o))) {
    return "ipv6_firewall";
  }
  if (item.scheme === "http" && items.some((o) => o.family === item.family && o.scheme === "https" && o.verdict === "open")) {
    return "http_port_closed";
  }
  return cause;
}

function serviceVerdict(service: CheckService, items: RemoteCheckItem[], cgnat: RemoteVerdict["cgnat"]): RemoteServiceVerdict {
  const tested = items.filter((i) => i.verdict !== "not_testable");
  const exposed = tested.some((i) => i.scheme === "http" && i.verdict === "open");
  const secure = tested.some((i) => i.scheme === "https" && i.verdict === "open");

  const causes = new Set<RemoteCause>();
  for (const item of items) {
    if (isOk(item)) continue;
    const cause = causeInContext(item, items);
    if (cause) causes.add(cause);
  }
  if (causes.has("port_not_forwarded") && (cgnat === "cgnat_suspected" || cgnat === "double_nat")) causes.add(cgnat);

  let state: RemoteServiceState;
  if (tested.length === 0) state = "not_checked";
  else if (exposed) state = "exposed_http";
  else if (secure) state = "secure";
  else if (tested.some(isOk) || [...causes].some((c) => c === "certificate" || c === "proxy_upstream" || c === "other_service")) {
    state = "attention";
  } else state = "unreachable";

  return { service, state, tone: TONES[state], causes: [...causes], items };
}

export function remoteVerdict(report: RemoteCheckReport | null, routerWanIp: string | null = null): RemoteVerdict {
  const cgnat = cgnatFromRouterWan(report?.publicIp.v4 ?? null, routerWanIp);
  const items = report?.outcome === "done" ? report.items : [];
  const services = (["tentacle", "jellyfin"] as const)
    .map((service) => serviceVerdict(service, items.filter((i) => i.service === service), cgnat))
    // Jellyfin n'apparaît que s'il avait une cible (lecture directe publique).
    .filter((v) => v.service === "tentacle" || v.items.length > 0);
  return { services, cgnat };
}
