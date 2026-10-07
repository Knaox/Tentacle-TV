import { isCheckablePort } from "./checkProtocol";
import type { RemoteCheckReport, ReverseProxyKind } from "./remoteAccessContract";
import { remoteVerdict } from "./remoteVerdict";

/**
 * L'accès depuis l'extérieur, en mots simples : les adresses publiques à
 * proposer (d'après l'adresse publique détectée et les VRAIS ports), et si le
 * serveur est déjà joignable — la même règle pour l'étape de l'assistant et
 * la section d'administration.
 */

/** Joignable depuis Internet ? `no_service` : le test automatique n'est pas en ligne. */
export type RemoteReachability = "open" | "closed" | "unknown" | "no_service" | "disabled";

export function reachabilityOf(report: RemoteCheckReport | null, checkServiceEnabled: boolean): RemoteReachability {
  if (!checkServiceEnabled) return "disabled";
  if (!report) return "unknown";
  if (report.outcome === "service_unavailable") return "no_service";
  if (report.outcome !== "done") return "unknown";
  const tentacle = remoteVerdict(report).services.find((service) => service.service === "tentacle");
  if (!tentacle || tentacle.state === "not_checked") return "unknown";
  return tentacle.state === "secure" || tentacle.state === "exposed_http" ? "open" : "closed";
}

function hostOf(ip: string): string {
  return ip.includes(":") ? `[${ip}]` : ip;
}

/**
 * Les adresses publiques proposées, sans mandataire : l'adresse de la box et
 * le port de chacun (`http://203.0.113.5:47300`). Avec un mandataire, rien :
 * ce sont ses domaines (`https://…`), réglés avec lui.
 */
export function suggestedPublicUrls(input: {
  proxy: ReverseProxyKind;
  publicIp: string | null;
  hostPort: number;
  jellyfinPort: number | null;
}): { tentacle: string | null; jellyfin: string | null } {
  if (input.proxy !== "none" || !input.publicIp) return { tentacle: null, jellyfin: null };
  const host = hostOf(input.publicIp);
  return {
    tentacle: `http://${host}:${input.hostPort}`,
    jellyfin: input.jellyfinPort ? `http://${host}:${input.jellyfinPort}` : null,
  };
}

/** Le test d'ouverture ne sait viser qu'un port testable : sinon, l'écran propose de vérifier à la main. */
export function portCheckable(port: number): boolean {
  return isCheckablePort(port);
}

/**
 * La lecture directe telle que l'écran la règle : l'adresse privée suffit à
 * l'allumer ; la publique n'est exigée que si l'interrupteur « depuis
 * l'extérieur » est allumé.
 */
export function directPlayIssues(draft: { enabled: boolean; privateUrl: string; publicEnabled: boolean; publicUrl: string }): Array<"private_missing" | "public_missing"> {
  const issues: Array<"private_missing" | "public_missing"> = [];
  if (draft.enabled && draft.privateUrl.trim() === "") issues.push("private_missing");
  if (draft.enabled && draft.publicEnabled && draft.publicUrl.trim() === "") issues.push("public_missing");
  return issues;
}
